// homebridge-p1/lib/P1Platform.js
// Copyright © 2018-2026 Erik Baauw. All rights reserved.
//
// Homebridge plugin for DSMR end-consumer (P1) interface.

import { OptionParser } from 'homebridge-lib/OptionParser'
import { Platform } from 'homebridge-lib/Platform'

import { P1Accessory } from './P1Accessory.js'

class P1Platform extends Platform {
  constructor (log, configJson, homebridge) {
    super(log, configJson, homebridge)
    this.heartbeatEnabled = true
    this
      .once('heartbeat', this.init)
      .on('heartbeat', this.heartbeat)
      .on('shutdown', this.shutdown)

    this.config = {
      dsmr22: false,
      port: 8088,
      timeout: 5
    }
    const optionParser = new OptionParser(this.config, true)
    optionParser
      .on('userInputError', (message) => {
        this.warn('config.json: %s', message)
      })
      .stringKey('name')
      .stringKey('platform')
      .boolKey('dsmr22')
      .hostKey()
      .stringKey('serialPort', true)
      .stringKey('telegram', true)
      .intKey('timeout', 5, 120)
      .intKey('wsPort', 1024, 65535)
      .parse(configJson)
    this.debug('config: %j', this.config)
  }

  async initTelegram () {
    const telegrams = await import('./telegrams.js')
    if (telegrams[this.config.telegram] == null) {
      this.warn('config.json: %s: no such fake telegram', this.config.telegram)
      return
    }
    const { P1Client } = await import('./P1Client.js')
    const p1 = new P1Client()
    p1
      .on('error', (error) => { this.warn(error) })
      .on('warning', (message) => { this.warn(message) })
      .once('telegram', (s) => { this.debug('telegram:\n%s', s) })
      .once('rawData', (obj) => { this.debug('raw data: %j', obj) })
      .once('data', (data) => { this.telegram = data })
      .parseTelegram(telegrams[this.config.telegram])
    if (this.config.wsPort != null) {
      this.warn('config.json: wsPort: ignored when telegram has been set')
    }
    if (this.config.serialPort != null) {
      this.warn(
        'config.json: serialPort: ignored when telegram has been set'
      )
    }
    if (this.config.hostname != null) {
      this.warn('config.json: host: ignored when telegram has been set')
    }
  }

  async initWsClient () {
    this.warn(
      'config.json: host: the web socket relay feature has been deprecated, see https://github.com/ebaauw/homebridge-p1/issues/83'
    )
    const { P1WsClient } = await import('./P1WsClient.js')
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
  }

  async initWsServer () {
    this.warn(
      'config.json: wsPort: the web socket relay feature has been deprecated, see https://github.com/ebaauw/homebridge-p1/issues/83'
    )
    const { P1WsServer } = await import('./P1WsServer.js')
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

  async init (beat) {
    try {
      if (this.config.telegram != null) {
        // Issue fake telegrams.
        return this.initTelegram()
      }
      if (this.config.hostname != null) {
        // Connect to remote web socket server
        return this.initWsClient()
      }
      // Connect to local serial port or ser2net.
      const { P1Client } = await import('./P1Client.js')
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
        await this.initWsServer()
      }
    } catch (error) {
      this.error(error)
    }
  }

  heartbeat (beat) {
    this.beat = beat
    if (this.telegram != null && beat % 5 === 0) {
      this.telegram.electricity.lastupdated = new Date().toISOString()
      this.telegram.electricity.consumption[this.telegram.electricity.tariff] += 5 / 3600
      this.onData(this.telegram)
      return
    }
    if (
      this.ws != null && !this.ws.isConnected('data') &&
      beat > this.connectWs
    ) {
      this.connectWs = beat + 60
      this.ws.connect('data').catch((error) => {
        this.connectWs = beat + 60
        this.warn(error)
      })
    }
    if (this.p1 != null && !this.p1.isOpen() && beat > this.connectP1) {
      this.connectP1 = beat + 60
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
      if (data.water != null) {
        this.water = new P1Accessory.Water(this, data.water)
      }
      this.debug('initialised')
      this.emit('initialised')
    } else {
      this.vdebug('data: %j', data)
      this.electricity.check(data.electricity)
      if (this.electricityBack != null && data.electricityBack != null) {
        this.electricityBack.check(data.electricityBack)
      }
      if (this.electricityCapacity != null) {
        this.electricityCapacity.check(data.electricity)
      }
      if (this.gas != null && data.gas != null) {
        this.gas.check(data.gas)
      }
      if (this.water != null && data.water != null) {
        this.water.check(data.water)
      }
    }
  }

  shutdown () {
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
}

export { P1Platform }
