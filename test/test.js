// homebridge-p1/test/test.js
// Copyright © 2020-2021 Erik Baauw. All rights reserved.
//
// Homebridge plugin for DSMR end-consumer (P1) interface.

'use strict'

const homebridgeLib = require('homebridge-lib')
const P1Client = require('../lib/P1Client')
const P1WsServer = require('../lib/P1WsServer')
const telegrams = require('../lib/telegrams')

let p1

const formatError = homebridgeLib.OptionParser.formatError

async function connect () {
  try {
    // const port = await p1.open()
    // console.log('connected to %s', port)
    setTimeout(() => { p1.parseTelegram(telegrams.v50) }, 1000)
    // setTimeout(() => { p1.parseTelegram(telegrams.be) }, 2000)
    // setTimeout(() => { p1.parseTelegram(telegrams.v50l3) }, 3000)
    // setTimeout(() => { p1.parseTelegram(telegrams.v42) }, 4000)
    // setTimeout(() => { p1.parseTelegram(telegrams.v22) }, 5000)
  } catch (error) {
    console.error(formatError(error))
    setTimeout(async () => {
      await connect()
    }, 10000)
  }
}

async function main () {
  p1 = new P1Client()
  // p1.on('ports', (ports) => { console.log('found ports %j', ports) })
  p1.on('error', (error) => {
    console.error(formatError(error))
  })
  p1.on('telegram', (telegram) => { console.log('telegram: %s', telegram) })
  p1.on('rawData', (data) => { console.log('rawdata:', data) })
  p1.on('data', (data) => { console.log('data:', data) })
  p1.on('warning', (message) => { console.log('warning: %s', message) })
  p1.on('close', () => {
    console.log('connection closed')
    setTimeout(async () => {
      await connect()
    }, 10000)
  })
  const server = new P1WsServer(p1)
  server.on('listening', (port) => { console.log('listening on port %d', port) })
  server.on('connect', (host, path) => { console.log('%s: %s client connected', host, path) })
  server.on('disconnect', (host, path) => { console.log('%s: %s client disconnected', host, path) })
  server.on('warning', (message) => { console.log('warning: %s', message) })
  await connect()
}

main()
