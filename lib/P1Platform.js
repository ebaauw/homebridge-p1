// homebridge-p1/lib/P1Platform.js
// Copyright © 2018-2021 Erik Baauw. All rights reserved.
//
// Homebridge plugin for DSMR end-consumer (P1) interface.

'use strict'

const homebridgeLib = require('homebridge-lib')
const P1Accessory = require('./P1Accessory')
const P1Client = require('./P1Client')
const P1WsClient = require('./P1WsClient')
const P1WsServer = require('./P1WsServer')
const telegrams = require('./telegrams')

class P1Platform extends homebridgeLib.Platform {
  constructor (log, configJson, homebridge) {
    super(log, configJson, homebridge)
    this.heartbeatEnabled = true
    this
      .on('heartbeat', (beat) => { this.onHeartbeat(beat) })
      .on('shutdown', () => { this.onShutdown() })

    this.config = {
      dsmr22: false,
      port: 8088,
      timeout: 5
    }
    const optionParser = new homebridgeLib.OptionParser(this.config, true)
    optionParser
      .on('userInputError', (message) => {
        this.warn('config.json: %s', message)
      })
      .stringKey('name')
      .stringKey('platform')
      .boolKey('button')
      .boolKey('dsmr22')
      .stringKey('telegram', true)
      .hostKey()
      .stringKey('serialPort', true)
      .intKey('timeout', 5, 120)
      .intKey('wsPort', 1024, 65535)
    try {
      optionParser.parse(configJson)
      this.debug('config: %j', this.config)
      if (this.config.telegram != null) {
        // Issue fake telegrams.
        if (telegrams[this.config.telegram] != null) {
          const p1 = new P1Client()
          p1.once('data', (data) => { this.telegram = data })
          p1.parseTelegram(telegrams[this.config.telegram])
        } else {
          this.warn(
            'config.json: %s: no such fake telegram', this.config.telegram
          )
        }
        if (this.config.wsPort != null) {
          this.warn('config.json: wsPort: ignored when telegram has been set')
          delete this.config.wsPort
        }
        if (this.config.serialPort != null) {
          this.warn(
            'config.json: serialPort: ignored when telegram has been set'
          )
        }
        if (this.config.hostname != null) {
          this.warn('config.json: host: ignored when telegram has been set')
        }
      } else if (this.config.hostname != null) {
        // Connect to remote web socket server
        const wsParams = {
          host: this.config.hostname + ':' + this.config.port,
          timeout: this.config.timeout
        }
        this.ws = new P1WsClient(wsParams)
        this.connectWs = -1
        this.ws
          .on('error', (error) => { this.warn(error) })
          .on('connect', (url) => { this.log('connected to %s', url) })
          .on('disconnect', (url) => {
            this.connectWs = this.beat + 60
            this.log('disconnected from %s', url)
          })
          .on('data', (data) => { this.onData(data) })
        if (this.config.wsPort != null) {
          this.warn('config.json: wsPort: ignored when host has been set')
          delete this.config.wsPort
        }
        if (this.config.serialPort != null) {
          this.warn('config.json: serialPort: ignored when host has been set')
        }
      } else {
        // Connect to local serial port.
        const params = {
          dsmr22: this.config.dsmr22,
          timeout: this.config.timeout
        }
        if (this.config.serialPort != null) {
          params.serialPort = this.config.serialPort
        }
        this.p1 = new P1Client(params)
        this.connectP1 = -1
        this.p1
          .on('open', (port) => { this.log('connected to %s', port) })
          .on('close', (port) => {
            this.connectP1 = this.beat + 60
            this.log('disconnected from %s', port)
          })
          .on('error', (error) => { this.warn(error) })
          .on('warning', (message) => { this.warn(message) })
          .on('ports', (ports) => { this.debug('ports: %j', ports) })
          .once('telegram', (s) => { this.debug('telegram:\n%s', s) })
          .once('rawData', (obj) => { this.debug('raw data: %j', obj) })
          .on('data', (data) => { this.onData(data) })

        if (this.config.wsPort != null) {
          // Relay telegrams through local web socket server.
          this.server = new P1WsServer(this.p1, { port: this.config.wsPort })
          this.connectServer = -1
          this.server
            .on('server: listening', (port) => {
              this.log('listening on port %d', port)
            })
            .on('close', (port) => {
              this.log('server: disconnected from port %d', port)
            })
            .on('connect', (host, path) => {
              this.log('server: %s connected to %s', host, path)
            })
            .on('disconnect', (host, path) => {
              this.connectServer = this.beat + 60
              this.log('server: %s disconnected from %s', host, path)
            })
            .on('warning', (message) => {
              this.warn('server: %s', message)
            })
            .on('error', (error) => {
              this.warn('server: %s', error)
            })
        }
      }
    } catch (error) {
      this.fatal(error)
    }
  }

  onHeartbeat (beat) {
    this.beat = beat
    if (this.telegram != null && beat % 5 === 0) {
      this.telegram.electricity.lastupdated = new Date().toISOString()
      ++this.telegram.electricity.consumption[this.telegram.electricity.tariff]
      this.onData(this.telegram)
      return
    }
    if (
      this.ws != null && !this.ws.isConnected('data') &&
      beat > this.connectWs
    ) {
      delete this.connectWs
      this.ws.connect('data').catch((error) => {
        this.connectWs = beat + 60
        this.warn(error)
      })
    }
    if (this.p1 != null && !this.p1.isOpen() && beat > this.connectP1) {
      delete this.connectP1
      this.p1.open().catch((error) => {
        this.connectP1 = beat + 60
        this.warn(error)
      })
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
    if (this.ws != null) {
      this.ws.disconnect('data')
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
