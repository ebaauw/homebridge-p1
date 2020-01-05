// homebridge-p1/lib/P1WsClient.js
// Copyright © 2018-2020 Erik Baauw. All rights reserved.
//
// Homebridge plugin for DSMR end-consumer (P1) interface.

'use strict'

const homebridgeLib = require('homebridge-lib')
const EventEmitter = require('events')
const WebSocket = require('ws')

/** Class for P1 Web Socket client.
  * @extends EventEmitter
  */
class P1WsClient extends EventEmitter {
  /** Create a new insance of P1 web socket client.
    *
    * @param {?object} options - Optional parameters.
    * @param {string} [options.host='127.0.0.1:8088'] - _hostname_`:`_port_
    * of the web socket server.
    * @param {?int} [options.timeout=5] - Timeout in seconds to wait for next
    * telegram from the P1.  Must be between 5 and 120.  When `options.dsmr22`
    * has been set, a default of 50 is used.
    * @throws `TypeError` - When a parameter has an invalid type.
    * @throws `RangeError` - When a parameter has an invalid value.
    * @throws `SyntaxError` - When a mandatory parameter is missing or an
    * optional parameter is not applicable.
    */
  constructor (options) {
    super()
    this._options = {
      hostname: '127.0.0.1',
      port: 8088,
      timeout: 5
    }
    const optionParser = new homebridgeLib.OptionParser(this._options)
    optionParser.hostKey()
    optionParser.intKey('timeout', 5, 120)
    optionParser.parse(options)
    this.ws = {}
  }

  async connect (path) {
    const url = 'ws://' + this._options.hostname + ':' + this._options.port +
      '/' + path
    const ws = new WebSocket(url)
    this.ws[path] = ws
    ws.on('open', () => { this.emit('open', url) })
    ws.on('close', () => {
      ws.removeAllListeners()
      delete this.ws[path]
      this.emit('close', url)
    })
    ws.on('message', (message) => {
      if (path !== 'telegram') {
        try {
          message = JSON.parse(message)
        } catch (error) {
          this.emit('error', error)
        }
      }
      this.emit(path, message)
    })
  }

  async disconnect (path) {
    if (this.ws[path] != null) {
      this.ws[path].close()
    }
  }
}

module.exports = P1WsClient
