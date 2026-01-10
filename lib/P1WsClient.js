// homebridge-p1/lib/P1WsClient.js
// Copyright © 2018-2026 Erik Baauw. All rights reserved.
//
// Homebridge plugin for DSMR end-consumer (P1) interface.

import { EventEmitter } from 'node:events'

import WebSocket from 'ws'

import { OptionParser } from 'homebridge-lib/OptionParser'

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
    * has been set, a default of 5 is used.
    * @throws `TypeError` - When a parameter has an invalid type.
    * @throws `RangeError` - When a parameter has an invalid value.
    * @throws `SyntaxError` - When a mandatory parameter is missing or an
    * optional parameter is not applicable.
    */
  constructor (options) {
    super()
    this._options = {
      hostname: 'localhost',
      port: 8088,
      timeout: 5
    }
    const optionParser = new OptionParser(this._options)
    optionParser.hostKey()
    optionParser.intKey('timeout', 5, 120)
    optionParser.parse(options)
    this._ws = {}
    this._timeout = {}
  }

  async connect (path) {
    const url = 'ws://' + this._options.hostname + ':' + this._options.port +
      '/' + path
    const ws = new WebSocket(url)
    this._ws[path] = ws
    ws
      .on('open', () => {
        this.emit('connect', url)
        this._setTimeout(path)
      })
      .on('close', () => {
        if (this._timeout[path] != null) {
          clearTimeout(this._timeout[path])
        }
        ws.removeAllListeners()
        delete this._ws[path]
        this.emit('disconnect', url)
      })
      .on('message', (message) => {
        this._setTimeout(path)
        if (path !== 'telegram') {
          try {
            message = JSON.parse(message.toString())
          } catch (error) {
            this.emit('error', error)
          }
        }
        this.emit(path, message)
      })
      .on('error', (error) => { this.emit('error', error) })
  }

  isConnected (path) {
    return this._ws[path] != null
  }

  _setTimeout (path) {
    if (this._timeout[path] != null) {
      clearTimeout(this._timeout[path])
    }
    this._timeout[path] = setTimeout(() => {
      this.emit('error', new Error(
        `no data recevied in ${this._options.timeout} seconds`
      ))
      this._ws[path].terminate()
      // this.disconnect(path)
    }, this._options.timeout * 1000)
  }

  disconnect (path) {
    if (this._ws[path] != null) {
      this._ws[path].close()
    }
  }
}

export { P1WsClient }
