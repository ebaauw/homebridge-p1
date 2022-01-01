// homebridge-p1/lib/P1WsServer.js
// Copyright © 2018-2022 Erik Baauw. All rights reserved.
//
// Homebridge plugin for DSMR end-consumer (P1) interface.

'use strict'

const homebridgeLib = require('homebridge-lib')
const EventEmitter = require('events')
const WebSocket = require('ws')

/** Class for P1 Web Socket server.
  *
  * The server creates three websocket endpoints: `telegram`, `rawData`, and
  * `data`.
  * The `telegram` endpoint sends a notification for each `telegram`
  * event from the P1 client.
  * The `rawData` and `data` endpoints send a notification of the `rawData`
  * and `data` events, converted to JSON.
  * @extends EventEmitter
  */
class P1WsServer extends EventEmitter {
  /** Create a new instance of a P1 web socket server.
    * @param {P1Client} p1 - The accociated P1 client.
    * @param {?object} options - Optional paramters.
    * @param {int} [options.port=8088] - The port for the web socket server.
    */
  constructor (p1, options = {}) {
    super()
    this._options = {
      port: 8088
    }
    const optionParser = new homebridgeLib.OptionParser(this._options)
    optionParser.intKey('port', 1024, 65535)
    optionParser.parse(options)

    this.jsonFormatter = new homebridgeLib.JsonFormatter({
      noWhiteSpace: true
    })

    p1
      .on('telegram', (telegram) => { this.onEvent('telegram', telegram) })
      .on('rawData', (data) => { this.onEvent('rawData', data) })
      .on('data', (data) => { this.onEvent('data', data) })

    this.clients = {}
    this.server = new WebSocket.Server(this._options)
    this.server
      .on('listening', () => {
        /** Emitted when the web socket server has started.
          * @event P1WsServer#listening
          * @param {int} port - The port the server is listening on.
          */
        this.emit('listening', this._options.port)
      })
      .on('connection', (ws, req) => {
        const socket = req.connection
        const id = socket.remoteAddress + ':' + socket.remotePort
        const path = req.url.slice(1)
        if (!['telegram', 'rawData', 'data'].includes(path)) {
          socket.destroy()
          this.emit(
            'warning', `${id}: web socket connection for invalid path ${path}`
          )
          return
        }
        /** Emitted when a client has connected.
          * @event P1WsServer#connect
          * @param {string} host - The client's _hostname_`:`_port_.
          * @param {string} path - The path to which the client connected:
          * `data`, `rawData`, or `telegram`
          */
        this.emit('connect', id, path)
        this.clients[id] = { path: path, ws: ws }
        ws.on('close', () => {
          socket.destroy()
          delete this.clients[id]
          /** Emitted when a client has disconnected.
            * @event P1WsServer#disconnect
            * @param {string} host - The client's _hostname_`:`_port_.
            * @param {string} path - The path to which the client connected:
            * `data`, `rawData`, or `telegram`
            */
          this.emit('disconnect', id, path)
        })
      })
  }

  onEvent (path, data) {
    const message = path === 'telegram'
      ? data
      : this.jsonFormatter.stringify(data)
    for (const id in this.clients) {
      const client = this.clients[id]
      if (client.path === path && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(message)
      }
    }
  }

  disconnect () {
    this.server.close()
    this.server.removeAllListeners()
    /** Emitted when the web socket server has stopped.
      * @event P1WsServer#close
      * @param {int} port - The port the server was listening on.
      */
    this.emit('close', this._options.port)
  }
}

module.exports = P1WsServer
