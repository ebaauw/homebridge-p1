// homebridge-p1/test/test.js
// Copyright © 2020-2026 Erik Baauw. All rights reserved.
//
// Homebridge plugin for DSMR end-consumer (P1) interface.

import { formatError, timeout } from 'homebridge-lib'
import { JsonFormatter } from 'homebridge-lib/JsonFormatter'

import { P1Client } from '../lib/P1Client.js'
// import { P1WsServer } from '../lib/P1WsServer.js'
import * as telegrams from '../lib/telegrams.js'

let p1

async function connect () {
  try {
    // const port = await p1.open()
    // console.log('connected to %s', port)
    for (const key of ['v22', 'v42', 'v42l3', 'v50', 'v50l3', 'v50be', 'v50be17']) {
      try {
        await timeout(1000)
        console.log('%j', telegrams[key])
        p1.parseTelegram(telegrams[key])
      } catch (error) {
        console.error(formatError(error))
      }
    }
  } catch (error) {
    console.error(formatError(error))
    setTimeout(async () => {
      await connect()
    }, 10000)
  }
}

async function main () {
  p1 = new P1Client()
  const formatter = new JsonFormatter()
  p1.on('ports', (ports) => { console.log('found ports %j', ports) })
  p1.on('error', (error) => { console.error(formatError(error)) })
  p1.on('telegram', (telegram) => { console.log('telegram: %s', telegram) })
  p1.on('rawData', (data) => { console.log('rawdata: %s', formatter.stringify(data)) })
  p1.on('data', (data) => { console.log('data: %s', formatter.stringify(data)) })
  p1.on('warning', (message) => { console.log('warning: %s', message) })
  p1.on('close', () => {
    console.log('connection closed')
    setTimeout(async () => {
      await connect()
    }, 10000)
  })
  // const server = new P1WsServer(p1)
  // server.on('listening', (port) => { console.log('listening on port %d', port) })
  // server.on('connect', (host, path) => { console.log('%s: %s client connected', host, path) })
  // server.on('disconnect', (host, path) => { console.log('%s: %s client disconnected', host, path) })
  // server.on('warning', (message) => { console.log('warning: %s', message) })
  await connect()
}

main()
