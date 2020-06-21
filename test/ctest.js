// homebridge-p1/test/ctest.js
// Copyright © 2020 Erik Baauw. All rights reserved.
//
// Homebridge plugin for DSMR end-consumer (P1) interface.

const P1WsClient = require('../lib/P1WsClient')

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

async function main () {
  const p1 = new P1WsClient({ host: 'localhost' })
  p1.on('error', (error) => {
    console.error('error: %s', errorToString(error))
  })
  p1.on('connect', (url) => { console.log('connected to %s', url) })
  p1.on('disconnect', (url) => { console.log('disconnected from %s', url) })
  p1.on('telegram', (telegram) => { console.log('telegram: %s', telegram) })
  p1.on('rawData', (data) => { console.log('rawData:', data) })
  p1.on('data', (data) => { console.log('data:', data) })

  // p1.connect('telegram')
  // p1.connect('rawData')
  p1.connect('data')
}

main()
