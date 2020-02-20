// homebridge-p1/lib/P1Platform.js
// Copyright © 2018-2020 Erik Baauw. All rights reserved.
//
// Homebridge plugin for DSMR end-consumer (P1) interface.

'use strict'

const semver = require('semver')

const homebridgeLib = require('homebridge-lib')
const P1AccessoryModule = require('./P1Accessory')
const P1Accessory = P1AccessoryModule.P1Accessory
const P1Client = require('./P1Client')
const P1WsServer = require('./P1WsServer')
const telegrams = require('./telegrams')
const packageJson = require('../package.json')

module.exports = P1Platform

function toIntBetween (value, minValue, maxValue, defaultValue) {
  const n = Number(value)
  if (isNaN(n) || n !== Math.floor(n) || n < minValue || n > maxValue) {
    return defaultValue
  }
  return n
}

function minVersion (range) {
  let s = range.split(' ')[0]
  while (s) {
    if (semver.valid(s)) {
      break
    }
    s = s.substring(1)
  }
  return s || undefined
}

const stackTraceErrors = [
  'AssertionError',
  'RangeError',
  'ReferenceError',
  'SyntaxError',
  'TypeError'
]

function errorToString (error) {
  return stackTraceErrors.includes(error.constructor.name)
    ? error.stack
    : error.message
}

// ===== P1Platform ============================================================

function P1Platform (log, configJson, homebridge) {
  this.log = log
  this.api = homebridge
  this.packageJson = packageJson
  this.configJson = configJson
  homebridge.on('shutdown', () => { this.onShutdown() })
  const my = new homebridgeLib.MyHomeKitTypes(homebridge)
  const eve = new homebridgeLib.EveHomeKitTypes(homebridge)
  P1AccessoryModule.setHomebridge(homebridge, my, eve)
  this.config = { timeout: 5 }
  for (const key in configJson) {
    const value = configJson[key]
    switch (key.toLowerCase()) {
      case 'dsmr22':
        this.config.dsmr22 = true
        break
      case 'faketelegram':
        if (telegrams[value] != null) {
          this.fakeTelegram = telegrams[value]
        } else {
          this.log.warn('config.json: %s: no such fake telegram', value)
        }
        break
      case 'name':
        break
      case 'platform':
        break
      case 'serialport':
        this.config.serialPort = value
        break
      case 'timeout':
        this.config.timeout = toIntBetween(
          value, 5, 120, this.config.timeout
        )
        break
      case 'wsport':
        this.wsPort = toIntBetween(
          value, 1024, 65535, 0
        )
        break
      default:
        this.log.warn('config.json: warning: %s: ignoring unknown key', key)
        break
    }
  }
  if (this.config.dsmr22 && this.config.timeout < 50) {
    this.config.timeout = 50
  }
  this.identify()
}

P1Platform.prototype.accessories = async function (callback) {
  const accessoryList = []

  try {
    const npmClient = new homebridgeLib.HttpClient({
      https: true,
      host: 'registry.npmjs.org',
      json: true
    })
    const response = await npmClient.get(
      '/' + packageJson.name + '/latest', { Accept: 'application/json' }
    )
    if (response != null && response.body != null && response.body.version != null) {
      const latest = response.body.version
      if (latest !== packageJson.version) {
        this.log.warn('warning: latest version: %s v%s', packageJson.name, latest)
      } else {
        this.log.debug('latest version: %s v%s', packageJson.name, latest)
      }
    }
  } catch (error) {
    this.log.error('npm registry: %s', error.message)
  }

  this.p1 = new P1Client(this.config)
  this.p1.on('error', (error) => {
    this.log.error('error: %s', errorToString(error))
  })
  this.p1.on('warning', (message) => {
    this.log.warn('warning: %s', message)
  })
  this.p1.on('ports', (ports) => { this.log.debug('ports: %j', ports) })
  this.p1.once('telegram', (s) => { this.log.debug('telegram:\n%s', s) })
  this.p1.once('rawData', (obj) => { this.log.debug('raw data: %j', obj) })
  this.p1.on('data', (data) => {
    try {
      if (this.electricity == null) {
        this.log.debug('data: %j', data)
        this.log('%s v%s', data.type, data.version)
        this.electricity = new P1Accessory(this, 'Electricity', data.electricity)
        accessoryList.push(this.electricity)
        if (
          data.electricityBack != null &&
          data.electricityBack.consumption != null && (
            data.electricityBack.consumption.low > 0 ||
            data.electricityBack.consumption.normal > 0
          )
        ) {
          this.electricityBack = new P1Accessory(
            this, 'Electricity Delivered', data.electricityBack
          )
          accessoryList.push(this.electricityBack)
        }
        if (data.gas != null) {
          this.gas = new P1Accessory(this, 'Gas', data.gas)
          accessoryList.push(this.gas)
        }
        setInterval(() => {
          this.electricity.addEntry()
          if (this.electricityBack != null) {
            this.electricityBack.addEntry()
          }
          if (this.gas != null) {
            this.gas.addEntry()
          }
        }, 10 * 60 * 1000)
        this.connected = true
        if (this.timedout) {
          this.log.error('data received too late - see README')
        } else {
          callback(accessoryList)
        }
      } else {
        // this.log.debug('data: %j', data)
        this.electricity.check(data.electricity)
        if (this.electricityBack != null) {
          this.electricityBack.check(data.electricityBack)
        }
        if (this.gas != null) {
          this.gas.check(data.gas)
        }
      }
    } catch (error) {
      this.log.error(error)
    }
  })

  if (this.wsPort != null) {
    this.server = new P1WsServer(this.p1, { port: this.wsPort })
    this.server.on('listening', (port) => {
      this.log('web socket server listening on port %d', port)
    })
    this.server.on('connect', (host, path) => {
      this.log('%s: web socket %s client connected', host, path)
    })
    this.server.on('disconnect', (host, path) => {
      this.log('%s: web socket %s client disconnected', host, path)
    })
    this.server.on('warning', (message) => {
      this.log.warn(message)
    })
    this.server.on('error', (error) => {
      this.log.error('error: %s', errorToString(error))
    })
  }
  if (this.fakeTelegram != null) {
    // Repeatedly issue the same fake telegram for testing.
    this.interval = setInterval(() => {
      this.p1.parseTelegram(this.fakeTelegram)
    }, 2000)
  } else {
    this.p1.open().then((port) => {
      this.log('connected to %s', port)
      setTimeout(() => {
        if (!this.connected) {
          this.timedout = true
          this.log.error('%s: no valid data received', port)
          callback(accessoryList)
        }
      }, this.config.timeout * 1000)
    }).catch((error) => {
      this.log.error('error: %s', errorToString(error))
      callback(accessoryList)
    })
  }
}

P1Platform.prototype.onShutdown = function () {
  this.log('shutting down...')
  if (this.interval != null) {
    clearInterval(this.interval)
  }
  if (this.p1 != null) {
    this.p1.close()
  }
}

P1Platform.prototype.identify = function () {
  this.log.info(
    '%s v%s, node %s, homebridge v%s', packageJson.name,
    packageJson.version, process.version, this.api.serverVersion
  )
  if (semver.clean(process.version) !== minVersion(packageJson.engines.node)) {
    this.log.warn(
      'warning: not using recommended node version v%s LTS',
      minVersion(packageJson.engines.node)
    )
  }
  if (this.api.serverVersion !== minVersion(packageJson.engines.homebridge)) {
    this.log.warn(
      'warning: not using recommended homebridge version v%s',
      minVersion(packageJson.engines.homebridge)
    )
  }
  this.log.debug('config.json: %j', this.configJson)
}
