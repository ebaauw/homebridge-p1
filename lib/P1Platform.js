// homebridge-p1/lib/WSPlatform.js
// Copyright © 2018 Erik Baauw. All rights reserved.
//
// Homebridge plugin for DSMR end-consumer (P1) interface.

'use strict'

const semver = require('semver')

const homebridgeLib = require('homebridge-lib')
const P1AccessoryModule = require('./P1Accessory')
const P1Accessory = P1AccessoryModule.P1Accessory
const P1Client = require('./P1Client')
const packageJson = require('../package.json')

module.exports = {
  P1Platform: P1Platform,
  setHomebridge: setHomebridge
}

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

// ===== Homebridge ============================================================

let homebridgeVersion

function setHomebridge (homebridge) {
  homebridgeVersion = homebridge.serverVersion
  const my = new homebridgeLib.MyHomeKitTypes(homebridge)
  const eve = new homebridgeLib.EveHomeKitTypes(homebridge)
  P1AccessoryModule.setHomebridge(homebridge, my, eve)
}

// ===== P1Platform ============================================================

function P1Platform (log, configJson, api) {
  this.log = log
  this.api = api
  this.packageJson = packageJson
  this.configJson = configJson
  this.config = { timeout: 5 }
  for (const key in configJson) {
    const value = configJson[key]
    switch (key.toLowerCase()) {
      case 'dsmr22':
        this.config.dsmr22 = true
        break
      case 'name':
        this.config.name = value
        break
      case 'platform':
        break
      case 'serialport':
        this.config.comName = value
        break
      case 'timeout':
        this.config.timeout = toIntBetween(
          value, 5, 120, this.config.timeout
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

P1Platform.prototype.accessories = function (callback) {
  let accessoryList = []
  const npmRegistry = new homebridgeLib.RestClient({
    host: 'registry.npmjs.org',
    name: 'npm registry'
  })
  npmRegistry.get(packageJson.name).then((response) => {
    if (
      response && response['dist-tags'] &&
      response['dist-tags'].latest !== packageJson.version
    ) {
      this.log.warn(
        'warning: lastest version: %s v%s', packageJson.name,
        response['dist-tags'].latest
      )
    }
  }).catch((err) => {
    this.log.error('%s', err)
  }).then(() => {
    this.p1 = new P1Client()
    this.p1.on('ports', (ports) => {
      this.log.debug('ports: %j', ports)
    })
    this.p1.on('telegram', (s) => {
      this.log.debug('telegram:\n/%s', s)
    })
    this.p1.once('rawdata', (obj) => {
      this.log.debug('raw data: %j', obj)
    })
    this.p1.on('line', (line) => {
      this.log.debug('line: %s', line)
    })
    this.p1.on('unknownKey', (line) => {
      this.log.warn('warning: unknown key: %s', line)
    })
    this.p1.on('data', (data) => {
      try {
        if (this.electricity == null) {
          this.log.debug('data: %j', data)
          this.log('%s v%s', data.type, data.version)
          this.electricity = new P1Accessory(this, 'Electricity', data.electricity)
          accessoryList.push(this.electricity)
          if (data.gas != null) {
            this.gas = new P1Accessory(this, 'Gas', data.gas)
            accessoryList.push(this.gas)
          }
          setInterval(() => {
            this.electricity.addEntry()
            if (this.gas != null) {
              this.gas.addEntry()
            }
          }, 10 * 60 * 1000)
          this.connected = true
          callback(accessoryList)
        } else {
          this.electricity.check(data.electricity)
          if (this.gas != null) {
            this.gas.check(data.gas)
          }
        }
      } catch (error) {
        this.log.error(error)
      }
    })
    this.p1.connect(this.config.comName, this.config.dsmr22).then((port) => {
      this.log.debug('listening on %s', port)
      setTimeout(() => {
        if (!this.connected) {
          this.log.error('%s: no valid data received', port)
          callback(accessoryList)
        }
      }, this.config.timeout * 1000)
    }).catch((error) => {
      this.log.error(error.message)
      callback(accessoryList)
    })
  }).catch((error) => {
    this.log.error(error)
    callback(accessoryList) // Not going to help if error was thrown by callback().
  })
}

P1Platform.prototype.identify = function () {
  this.log.info(
    '%s v%s, node %s, homebridge v%s', packageJson.name,
    packageJson.version, process.version, homebridgeVersion
  )
  if (semver.clean(process.version) !== minVersion(packageJson.engines.node)) {
    this.log.warn(
      'warning: not using recommended node version v%s LTS',
      minVersion(packageJson.engines.node)
    )
  }
  if (homebridgeVersion !== minVersion(packageJson.engines.homebridge)) {
    this.log.warn(
      'warning: not using recommended homebridge version v%s',
      minVersion(packageJson.engines.homebridge)
    )
  }
  this.log.debug('config.json: %j', this.configJson)
}
