// homebridge-p1/lib/P1Client.js
// Copyright © 2018 Erik Baauw. All rights reserved.
//
// Homebridge plugin for DSMR end-consumer (P1) interface.
//
// See https://www.netbeheernederland.nl/_upload/Files/Slimme_meter_15_a727fce1f1.pdf

'use strict'

const EventEmitter = require('events')
const SerialPort = require('serialport')
const parser = new SerialPort.parsers.Readline({ delimiter: '/' })

// ===== Telegram Parsing ======================================================

function parseVersion (value) {
  const a = value.match(/\((\d)(\d)\)/)
  return a == null ? null : a[1] + '.' + a[2]
}

function parseTimestamp (value) {
  const a = value.match(/\((\d\d)(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)(S|W)?\)/)
  // const tz = a[7] === 'S' ? 2 : 1
  return a == null
    ? null
    : `20${a[1]}-${a[2]}-${a[3]}T${a[4]}:${a[5]}:${a[6]}`
    // : `20${a[1]}-${a[2]}-${a[3]}T${a[4]}:${a[5]}:${a[6]}+0${tz}:00`
}

function parseString (value) {
  const a = value.match(/\d\d/g)
  return a == null ? null : a.reduce((s, c) => {
    return s + String.fromCharCode(parseInt(c, 16))
  }, '')
}

function parseValue (value) {
  const a = value.match(/\((\d+(?:\.\d+)?)(?:\*(.+))?\)/)
  switch (a[2]) {
    case undefined:
    case 's':
      return parseInt(a[1])
    case 'kWh':
    case 'V':
    case 'A':
    case 'm3':
      return parseFloat(a[1])
    case 'kW':
      return parseFloat(a[1]) * 1000
    default:
      return null
  }
}

function parseM3 (value) {
  return parseValue(value.match(/(\(\d+.\d+)\)/)[1] + '*m3)')
}

function parseTariff (value) {
  return parseValue(value) === 1 ? 'low' : 'normal'
}

function parseType (value) {
  const type = parseValue(value)
  switch (type) {
    // case ?:  return 'water'
    case 3: return 'gas'
    default: return 'd' + type
  }
}

function parseLog (values) {
  const log = {}
  const entries = parseValue(values[0])
  for (let i = 1; i <= entries; i++) {
    const date = parseTimestamp(values[2 * i])
    const duration = parseValue(values[2 * i + 1])
    if (date != null && duration != null) {
      log[date] = duration
    }
  }
  return log
}

const p1Keys = {
  '0-0:1.0.0': [{ key: 'lastupdated', f: parseTimestamp }],
  '0-0:96.1.1': [{ key: 'id', f: parseString }],
  '0-0:96.7.21': [{ key: 'failures_short', f: parseValue }],
  '0-0:96.7.9': [{ key: 'failures_long', f: parseValue }],
  '0-0:96.13.0': [{ key: 'msg_text', f: parseString }],
  '0-0:96.13.1': [{ key: 'msg_num', f: parseString }],
  '0-0:96.14.0': [{ key: 'tariff', f: parseTariff }],

  '0-1:24.1.0': [{ key: 'd1_type', f: parseType }],
  '0-1:24.2.1': [
    { key: 'd1_lastupdated', f: parseTimestamp },
    { key: 'd1_consumption', f: parseValue }
  ],
  '0-1:24.3.0': [
    { key: 'd1_lastupdated', f: parseTimestamp },
    {},
    {},
    {},
    {},
    {},
    { key: 'd1_consumption', f: parseM3 }
  ],
  '0-1:96.1.0': [{ key: 'd1_id', f: parseString }],

  '0-2:24.1.0': [{ key: 'd2_type', f: parseType }],
  '0-2:24.2.1': [
    { key: 'd2_lastupdated', f: parseTimestamp },
    { key: 'd2_consumption', f: parseValue }
  ],
  '0-2:24.3.0': [
    { key: 'd2_lastupdated', f: parseTimestamp },
    {},
    {},
    {},
    {},
    {},
    { key: 'd2_consumption', f: parseM3 }
  ],
  '0-2:96.1.0': [{ key: 'd2_id', f: parseString }],

  '0-3:24.1.0': [{ key: 'd3_type', f: parseType }],
  '0-3:24.2.1': [
    { key: 'd3_lastupdated', f: parseTimestamp },
    { key: 'd3_consumption', f: parseValue }
  ],
  '0-3:24.3.0': [
    { key: 'd3_lastupdated', f: parseTimestamp },
    {},
    {},
    {},
    {},
    {},
    { key: 'd3_consumption', f: parseM3 }
  ],
  '0-3:96.1.0': [{ key: 'd3_id', f: parseString }],

  '0-4:24.1.0': [{ key: 'd4_type', f: parseType }],
  '0-4:24.2.1': [
    { key: 'd4_lastupdated', f: parseTimestamp },
    { key: 'd4_consumption', f: parseValue }
  ],
  '0-4:24.3.0': [
    { key: 'd4_lastupdated', f: parseTimestamp },
    {},
    {},
    {},
    {},
    {},
    { key: 'd4_consumption', f: parseM3 }
  ],
  '0-4:96.1.0': [{ key: 'd4_id', f: parseString }],

  '1-0:1.7.0': [{ key: 'power', f: parseValue }],
  '1-0:1.8.1': [{ key: 'consumption_low', f: parseValue }],
  '1-0:1.8.2': [{ key: 'consumption_normal', f: parseValue }],
  '1-0:2.7.0': [{ key: 'power_back', f: parseValue }],
  '1-0:2.8.1': [{ key: 'consumption_back_low', f: parseValue }],
  '1-0:2.8.2': [{ key: 'consumption_back_normal', f: parseValue }],

  '1-0:21.7.0': [{ key: 'l1_power', f: parseValue }],
  '1-0:22.7.0': [{ key: 'l1_power_back', f: parseValue }],
  '1-0:31.7.0': [{ key: 'l1_current', f: parseValue }],
  '1-0:32.7.0': [{ key: 'l1_voltage', f: parseValue }],
  '1-0:32.32.0': [{ key: 'l1_sags', f: parseValue }],
  '1-0:32.36.0': [{ key: 'l1_swells', f: parseValue }],

  '1-0:41.7.0': [{ key: 'l2_power', f: parseValue }],
  '1-0:42.7.0': [{ key: 'l2_power_back', f: parseValue }],
  '1-0:51.7.0': [{ key: 'l2_current', f: parseValue }],
  '1-0:52.7.0': [{ key: 'l2_voltage', f: parseValue }],
  '1-0:52.32.0': [{ key: 'l2_sags', f: parseValue }],
  '1-0:52.36.0': [{ key: 'l2_swells', f: parseValue }],

  '1-0:61.7.0': [{ key: 'l3_power', f: parseValue }],
  '1-0:62.7.0': [{ key: 'l3_power_back', f: parseValue }],
  '1-0:71.7.0': [{ key: 'l3_current', f: parseValue }],
  '1-0:72.7.0': [{ key: 'l3_voltage', f: parseValue }],
  '1-0:72.32.0': [{ key: 'l3_sags', f: parseValue }],
  '1-0:72.36.0': [{ key: 'l3_swells', f: parseValue }],

  '1-0:99.97.0': [{ key: 'log', f: parseLog, allValues: true }],

  '1-3:0.2.8': [{ key: 'version', f: parseVersion }]
}

// ===== Example Telegrams =====================================================

// const telegramV22 = `/XMX5XMXABCE000063181
//
// 0-0:96.1.1(31333634303033302020202020202020)
// 1-0:1.8.1(32586.251*kWh)
// 1-0:1.8.2(36388.384*kWh)
// 1-0:2.8.1(00000.111*kWh)
// 1-0:2.8.2(00000.286*kWh)
// 0-0:96.14.0(0001)
// 1-0:1.7.0(0005.01*kW)
// 1-0:2.7.0(0000.00*kW)
// 0-0:96.13.1()
// 0-0:96.13.0()
// 0-1:96.1.0(3238303131303038333133313637353133)
// 0-1:24.1.0(03)
// 0-1:24.3.0(180902110000)(08)(60)(1)(0-1:24.2.0)(m3)
// (12007.760)
// !
// `
// const telegramV50 = `/XMX5LGBBLA4415290514
//
// 1-3:0.2.8(50)
// 0-0:1.0.0(180901194246S)
// 0-0:96.1.1(4530303435303034303134363938333137)
// 1-0:1.8.1(001362.372*kWh)
// 1-0:1.8.2(000851.129*kWh)
// 1-0:2.8.1(000000.000*kWh)
// 1-0:2.8.2(000000.000*kWh)
// 0-0:96.14.0(0001)
// 1-0:1.7.0(00.276*kW)
// 1-0:2.7.0(00.000*kW)
// 0-0:96.7.21(00002)
// 0-0:96.7.9(00000)
// 1-0:99.97.0(0)(0-0:96.7.19)
// 1-0:32.32.0(00002)
// 1-0:32.36.0(00000)
// 0-0:96.13.0()
// 1-0:32.7.0(230.0*V)
// 1-0:31.7.0(002*A)
// 1-0:21.7.0(00.276*kW)
// 1-0:22.7.0(00.000*kW)
// 0-1:24.1.0(003)
// 0-1:96.1.0(4730303339303031373637383534313137)
// 0-1:24.2.1(180901194004S)(00485.627*m3)
// !22EE
// `

// ===== P1Client ==============================================================

module.exports = class P1Client extends EventEmitter {
  async findPort (comName) {
    return new Promise((resolve, reject) => {
      SerialPort.list().then((ports) => {
        this.emit('ports', ports)
        for (const port of ports) {
          if (comName == null) {
            if (
              (port.vendorId === '0403' && port.productId === '6001') ||
              (port.vendorId === '067b' && port.productId === '2303') // Issue #7
            ) {
              return resolve(port)
            }
          } else if (comName === port.comName) {
            return resolve(port)
          }
        }
        if (comName == null) {
          reject(new Error('P1 USB cable not found'))
        }
        reject(new Error(`${comName}: port not found`))
      })
    })
  }

  async connect (comName, dsmr22 = false) {
    // this.parseData(telegramV22)
    const options = { baudRate: 115200 } // 115200 8N1
    if (dsmr22) { // 9600 7E1
      options.baudRate = 9600
      options.dataBits = 7
      options.parity = 'even'
    }
    return this.findPort(comName).then((port) => {
      return new Promise((resolve, reject) => {
        const p1 = new SerialPort(port.comName, options, (error) => {
          if (error) {
            return reject(new Error(`${port.comName}: cannot open`))
          }
          parser.on('data', (data) => { this.parseData(data) })
          p1.pipe(parser)
          resolve(port.comName)
        })
      })
    })
  }

  parseData (data) {
    try {
      if (data == null || typeof data !== 'string') {
        return
      }
      const header = data.match(/(.+)\r?\n\r?\n/)
      const footer = data.match(/(!)(.*)\r?\n/)
      if (header == null || footer == null) {
        return null
      }
      this.emit('telegram', data)
      // TODO: validate checksum
      const obj = { type: header[1], checksum: footer[2] }
      const lines = data.match(/\d+-\d+:\d+\.\d+\.\d+(\(.*\)\r?\n?)+\r?\n/g)
      for (const line of lines) {
        const keys = line.match(/\d+-\d+:\d+\.\d+\.\d+/)
        const values = line.match(/\([^)]*\)/g)
        const a = p1Keys[keys[0]]
        if (a == null) {
          this.emit('unknownKey', line.match(/(.*)\r?\n/)[1])
          continue
        }
        for (const id in a) {
          if (a[id].key != null) {
            obj[a[id].key] = a[id].f(a[id].allValues ? values : values[id])
          }
        }
      }
      this.emit('rawdata', obj)
      const result = {
        type: obj.type,
        version: obj.version == null ? '2.2' : obj.version,
        msg_text: obj.msg_text,
        msg_num: obj.msg_num,
        electricity: {
          id: obj.id.trim(),
          lastupdated: obj.lastupdated,
          tariff: obj.tariff,
          consumption: {
            low: obj.consumption_low,
            normal: obj.consumption_normal
          },
          power: obj.power,
          failures: {
            short: obj.failures_short,
            long: obj.failures_long,
            log: obj.log
          },
          l1: {
            voltage: obj.l1_voltage,
            sags: obj.l1_sags,
            swells: obj.l1_swells,
            current: obj.l1_current,
            power: obj.l1_power
          }
        },
        electricityBack: {
          id: obj.id.trim() + 'B',
          lastupdated: obj.lastupdated,
          tariff: obj.tariff,
          consumption: {
            low: obj.consumption_back_low,
            normal: obj.consumption_back_normal
          },
          power: obj.power_back,
          l1: { power: obj.l1_power_back }
        }
      }
      if (obj.l2_voltage != null) {
        result.electricity.l2 = {
          voltage: obj.l2_voltage,
          sags: obj.l2_sags,
          swells: obj.l2_swells,
          current: obj.l2_current,
          power: obj.l2_power
        }
        result.electricityBack.l2 = { power: obj.l2_power_back }
        result.electricity.l3 = {
          voltage: obj.l3_voltage,
          sags: obj.l3_sags,
          swells: obj.l3_swells,
          current: obj.l3_current,
          power: obj.l3_power
        }
        result.electricityBack.l3 = { power: obj.l3_power_back }
      }
      if (obj.d1_type != null) {
        result[obj.d1_type] = {
          id: obj.d1_id.trim(),
          lastupdated: obj.d1_lastupdated,
          consumption: obj.d1_consumption
        }
      }
      if (obj.d2_type != null) {
        result[obj.d1_type] = {
          id: obj.d2_id.trim(),
          lastupdated: obj.d2_lastupdated,
          consumption: obj.d2_consumption
        }
      }
      if (obj.d3_type != null) {
        result[obj.d3_type] = {
          id: obj.d3_id.trim(),
          lastupdated: obj.d3_lastupdated,
          consumption: obj.d3_consumption
        }
      }
      if (obj.d4_type != null) {
        result[obj.d4_type] = {
          id: obj.d4_id.trim(),
          lastupdated: obj.d4_lastupdated,
          consumption: obj.d4_consumption
        }
      }
      this.emit('data', result)
    } catch (error) {
      this.emit('error', error)
    }
  }
}
