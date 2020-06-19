// homebridge-p1/lib/P1Platform.js
// Copyright © 2018-2020 Erik Baauw. All rights reserved.
//
// Homebridge plugin for DSMR end-consumer (P1) interface.

'use strict'

const homebridgeLib = require('homebridge-lib')
const P1Accessory = require('./P1Accessory')
const P1Client = require('./P1Client')
const P1WsServer = require('./P1WsServer')
const P1WsClient = require('./P1WsClient')
const telegrams = require('./telegrams')

class P1Platform extends homebridgeLib.Platform {
  constructor (log, configJson, homebridge) {
    super(log, configJson, homebridge)
    this.heartbeatEnabled = true
    this.on('heartbeat', (beat) => { this.onHeartbeat(beat) })
    this.on('shutdown', () => { this.onShutdown() })

    this.config = {
      dsmr22: false,
      timeout: 5
    }
    const optionParser = new homebridgeLib.OptionParser(this.config, true)
    optionParser.on('userInputError', (message) => {
      this.warn('config.json: %s', message)
    })
    optionParser.stringKey('name')
    optionParser.stringKey('platform')
    optionParser.boolKey('dsmr22')
    optionParser.stringKey('telegram', true)
    optionParser.hostKey()
    optionParser.stringKey('serialPort', true)
    optionParser.intKey('timeout', 5, 120)
    optionParser.intKey('wsPort', 1024, 65535)
    try {
      optionParser.parse(configJson)
      if (this.config.telegram != null) {
        if (telegrams[this.config.telegram] != null) {
          const p1 = new P1Client()
          p1.once('data', (data) => { this.telegram = data })
          p1.parseTelegram(telegrams[this.config.telegram])
        } else {
          this.log.warn(
            'config.json: %s: no such fake telegram', this.config.telegram
          )
        }
      }
      this.debug('config: %j', this.config)
    } catch (error) {
      this.fatal(error)
    }
  }

  onHeartbeat (beat) {
    if (this.telegram != null && beat % 5 === 0) {
      this.telegram.electricity.lastupdated = new Date().toISOString()
      ++this.telegram.electricity.consumption[this.telegram.electricity.tariff]
      this.onData(this.telegram)
      return
    }
    if (beat % 60 === 0) {
      if (this.config.hostname != null && this.config.port != null) {
        // Connect to remote web socket server.
        if (this.p1WsClient == null) {
          const wsParams = {
            host: this.config.hostname + ':' + this.config.port,
            timeout: this.config.timeout
          }
          this.p1WsClient = new P1WsClient(wsParams)
          this.p1WsClient.on('error', (error) => { this.warn(error) })
          this.p1WsClient.on('connect', (url) => {
            this.log('connected to %s', url)
          })
          this.p1WsClient.on('disconnect', (url) => {
            this.log('disconnected from %s', url)
            this.p1WsClient.removeAllListeners()
            delete this.p1WsClient
          })
          this.p1WsClient.on('data', (data) => { this.onData(data) })
          this.p1WsClient.connect('data')
        }
        return
      }
      if (this.config.wsport != null) {
        // Setup local web socket server.
        if (this.server == null) {
          this.server = new P1WsServer(this.p1, { port: this.wsport })
          this.server.on('listening', (port) => {
            this.log('listening on port %d', port)
          })
          this.server.on('connect', (host, path) => {
            this.log('%s connected to %s', host, path)
          })
          this.server.on('disconnect', (host, path) => {
            this.log('%s disconnected from %s', host, path)
            this.server.removeAllListeners()
            delete this.server
          })
          this.server.on('warning', (message) => { this.warn(message) })
          this.server.on('error', (error) => { this.warn(error) })
        }
      }
      // Connect to P1 serial port
      if (this.p1 == null) {
        const params = {
          dsmr22: this.config.dsmr22,
          timeout: this.config.timeout
        }
        if (this.config.serialPort != null) {
          params.serialPort = this.config.serialPort
        }
        this.p1 = new P1Client(params)
        this.p1.on('open', (port) => { this.log('connected to %s', port) })
        this.p1.on('close', (port) => {
          this.log('disconnected from %s', port)
          this.p1.removeAllListeners()
          delete this.p1
        })
        this.p1.on('error', (error) => { this.warn(error) })
        this.p1.on('warning', (message) => { this.warn(message) })
        this.p1.on('ports', (ports) => { this.debug('ports: %j', ports) })
        this.p1.on('telegram', (s) => { this.vdebug('telegram:\n%s', s) })
        this.p1.on('rawData', (obj) => { this.vdebug('raw data: %j', obj) })
        this.p1.on('data', (data) => { this.onData(data) })
        this.p1.open().catch((error) => { this.warn(error) })
      }
    }
  }

  onData (data) {
    if (this.electricity == null) {
      this.debug('data: %j', data)
      this.log('%s v%s', data.type, data.version)
      this.electricity = new P1Accessory.Electricity(this, data.electricity)
      if (
        data.electricityBack != null &&
        data.electricityBack.consumption != null && (
          data.electricityBack.consumption.low > 0 ||
          data.electricityBack.consumption.normal > 0
        )
      ) {
        this.electricityBack = new P1Accessory.Electricity(
          this, data.electricityBack, 'Electricity Delivered'
        )
      }
      if (data.gas != null) {
        this.gas = new P1Accessory.Gas(this, data.gas)
      }
      this.debug('initialised')
      this.emit('initialised')
    } else {
      this.vdebug('data: %j', data)
      this.electricity.check(data.electricity)
      if (this.electricityBack != null) {
        this.electricityBack.check(data.electricityBack)
      }
      if (this.gas != null) {
        this.gas.check(data.gas)
      }
    }
  }

  onShutdown () {
    if (this.interval != null) {
      clearInterval(this.interval)
      delete this.interval
    }
    if (this.p1WsClient != null) {
      this.p1WsClient.disconnect('data')
    }
    if (this.p1 != null) {
      this.p1.close()
    }
    if (this.server != null) {
      this.server.disconnect()
    }
  }

  get logLevel () {
    return this.electricity == null ? 2 : this.electricity.logLevel
  }
}

module.exports = P1Platform
