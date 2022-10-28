// homebridge-p1/lib/P1Client.js
// Copyright © 2018-2022 Erik Baauw. All rights reserved.
//
// Homebridge plugin for DSMR end-consumer (P1) interface.

'use strict'

const homebridgeLib = require('homebridge-lib')
const net = require('net')
const EventEmitter = require('events')
const { SerialPort, ReadlineParser } = require('serialport')

// ===== Telegram Parsing ======================================================

function parseBreaker (value) {
  value = parseValue(value)
  switch (value) {
    case 0:
      return 'disconnected'
    case 1:
      return 'connected'
    case 2:
      return 'ready'
    default:
      throw new Error(`${value}: unknown breaker value`)
  }
}

function parseVersion (value) {
  const a = value.match(/^\((\d)(\d)(?:\d){0,3}\)$/)
  return a[1] + '.' + a[2]
}

function parseTimestamp (value) {
  const a = value.match(/^\((\d\d)(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)(S|W)?\)$/)
  // const tz = a[7] === 'S' ? 2 : 1
  return `20${a[1]}-${a[2]}-${a[3]}T${a[4]}:${a[5]}:${a[6]}`
  // return `20${a[1]}-${a[2]}-${a[3]}T${a[4]}:${a[5]}:${a[6]}+0${tz}:00`
}

function parseString (value) {
  const a = value.match(/\d\d/g)
  return a == null
    ? ''
    : a.reduce((s, c) => {
      return s + String.fromCharCode(parseInt(c, 16))
    }, '')
}

function parseValue (value) {
  const a = value.match(/^\((\d*(?:\.\d+)?)(?:\*(.+))?\)$/)
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
      return Math.round(parseFloat(a[1]) * 1000)
    default:
      throw new Error(`${a[2]}: unknown unit`)
  }
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
  '0-0:17.0.0': [{ key: 'max_power', f: parseValue }],
  '0-0:96.1.1': [{ key: 'id', f: parseString }],
  '0-0:96.1.4': [{ key: 'version_be', f: parseVersion }],
  '0-0:96.3.10': [{ key: 'breaker', f: parseBreaker }],
  '0-0:96.7.9': [{ key: 'failures_long', f: parseValue }],
  '0-0:96.7.21': [{ key: 'failures_short', f: parseValue }],
  '0-0:96.13.0': [{ key: 'msg_text', f: parseString }],
  '0-0:96.13.1': [{ key: 'msg_num', f: parseString }],
  '0-0:96.14.0': [{ key: 'tariff', f: parseValue }],

  '0-1:24.1.0': [{ key: 'd1_type', f: parseType }],
  '0-1:24.2.1': [
    { key: 'd1_lastupdated', f: parseTimestamp },
    { key: 'd1_consumption', f: parseValue }
  ],
  '0-1:24.2.3': [
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
    { key: 'd1_consumption', f: parseValue }
  ],
  '0-1:24.4.0': [{ key: 'd1_breaker', f: parseBreaker }],
  '0-1:96.1.0': [{ key: 'd1_id', f: parseString }],
  '0-1:96.1.1': [{ key: 'd1_id', f: parseString }],

  '0-2:24.1.0': [{ key: 'd2_type', f: parseType }],
  '0-2:24.2.1': [
    { key: 'd2_lastupdated', f: parseTimestamp },
    { key: 'd2_consumption', f: parseValue }
  ],
  '0-2:24.2.3': [
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
    { key: 'd2_consumption', f: parseValue }
  ],
  '0-2:24.4.0': [{ key: 'd2_breaker', f: parseBreaker }],
  '0-2:96.1.0': [{ key: 'd2_id', f: parseString }],
  '0-2:96.1.1': [{ key: 'd2_id', f: parseString }],

  '0-3:24.1.0': [{ key: 'd3_type', f: parseType }],
  '0-3:24.2.1': [
    { key: 'd3_lastupdated', f: parseTimestamp },
    { key: 'd3_consumption', f: parseValue }
  ],
  '0-3:24.2.3': [
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
    { key: 'd3_consumption', f: parseValue }
  ],
  '0-3:24.4.0': [{ key: 'd3_breaker', f: parseBreaker }],
  '0-3:96.1.0': [{ key: 'd3_id', f: parseString }],
  '0-3:96.1.1': [{ key: 'd3_id', f: parseString }],

  '0-4:24.1.0': [{ key: 'd4_type', f: parseType }],
  '0-4:24.2.1': [
    { key: 'd4_lastupdated', f: parseTimestamp },
    { key: 'd4_consumption', f: parseValue }
  ],
  '0-4:24.2.3': [
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
    { key: 'd4_consumption', f: parseValue }
  ],
  '0-4:24.4.0': [{ key: 'd4_breaker', f: parseBreaker }],
  '0-4:96.1.0': [{ key: 'd4_id', f: parseString }],
  '0-4:96.1.1': [{ key: 'd4_id', f: parseString }],

  '1-0:1.7.0': [{ key: 'power', f: parseValue }],
  '1-0:1.8.1': [{ key: 'consumption_t1', f: parseValue }],
  '1-0:1.8.2': [{ key: 'consumption_t2', f: parseValue }],
  '1-0:2.7.0': [{ key: 'power_back', f: parseValue }],
  '1-0:2.8.1': [{ key: 'consumption_back_t1', f: parseValue }],
  '1-0:2.8.2': [{ key: 'consumption_back_t2', f: parseValue }],

  '1-0:21.7.0': [{ key: 'l1_power', f: parseValue }],
  '1-0:22.7.0': [{ key: 'l1_power_back', f: parseValue }],
  '1-0:31.4.0': [{ key: 'max_current', f: parseValue }],
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

// ===== P1Client ==============================================================

/** Class for P1 serial port client.
  *
  * The DSMR standard defines the P1 interface for end consumers of smart
  * electricity meters provided by electricity network companies in the
  * Netherlands.
  * For details, see the
  * [P1 Companion Standard](https://www.netbeheernederland.nl/_upload/Files/Slimme_meter_15_a727fce1f1.pdf).
  *
  * In essence, the P1 interface is a serial port interface over an RJ11 socket,
  * with some non-standard pin assignments.
  * The easiest way to connect the smart meter to your computer is through a
  * USB P1 converter cable with a built-in FTDI serial port.
  * `P1Client` interfaces to the P1 using this serial port device.
  *
  * To open a connection to the serial port, call {@link P1Client#open open()}.
  * When `options.serialPort` hasn't been set,
  * {@link P1Client#_findPort _findPort()} is called to attempt automatic
  * discovery of the serial port.
  * In this case, a {@link P1Client#event:ports ports} event is emitted with
  * all serial ports found on the system.
  * When the connection has been established, an
  *{@link P1Client#event:open open} event is emitted.
  *
  * The connection is closed automatically when no telegram is received
  * for `options.timeout` seconds, since the connection was opened or the
  * last telegram was received.
  * The connection can be closed explicitly by calling
  * {@link P1Client#close close()}.
  * A {@link P1Client#event:close close} event is emitted after the connection
  * has been closed.
  *
  * Once connected, the smart meter sends a telegram on the P1 interface
  * every one (DSMR 5.0) to ten seconds (older DSMR versions).
  * `P1Client` validates and parses these telegrams into JavaScript objects,
  * emitting {@link P1Client#event:telegram telegram},
  * {@link P1Client#event:data data},
  * and {@link P1Client#event:rawData rawData} events as it proceeds.
  * On invalid telegrams, unsupported keys, or unsupported values,
  * {@link P1Client#event:warning warning} events are emitted.
  *
  * Note that the serial port only supports one connection at a time.
  * For multiple concurrent clients, setup an instance of {@link P1WsServer}
  * linked to the `P1Client` instance, and use multuple instances of
  * {@link P1WsClient} to connect the clients.
  *
  * `P1Client` extends [EventEmitter](https://nodejs.org/dist/latest-v12.x/docs/api/events.html#events_class_eventemitter).
  * @extends EventEmitter
  */
class P1Client extends EventEmitter {
  /** Find serial ports on the system.
    * @returns {Port[]} - A list of found serial ports.
    */
  static async findPorts () {
    const ports = await SerialPort.list()
    return ports
  }

  /** Check whether a discovered serial port could be a USB P1 converter cable.
    * @param {Port} port - The port object as returned by
    * {@link P1Client.findPorts findPorts()}.
    * @returns {boolean} - True if the USB signature matches.
    */
  static isP1 (port) {
    if (
      (port.vendorId === '0403' && port.productId === '6001') ||
      (port.vendorId === '067b' && port.productId === '2303') // Issue #7
    ) {
      return true
    }
    return false
  }

  /** Create a new instance P1 serial port client.
    * @param {?object} options - Optional parameters.
    * @param {?string} options.serialPort - The path to the serial port device,
    * corresponding to the USB P1 converter cable, e.g. `'/dev/USB0'`.
    * When not specified, automatic discovery is attempted, using the USB
    * signature of the converter cable.
    * @param {boolean} [options.dsmr22=false] - Use DSMR v2.2 settings for the
    * serial interface: 7N1 at 9600 baud instead of 8N1 at 115200 baud.
    * @param {int} [options.timeout=5] - Timeout in seconds to wait for next
    * telegram from the P1.  Must be between 5 and 120.  When `options.dsmr22`
    * has been set, a default of 50 is used.<br>
    * When no telegram has been received in `timeout` seconds, the connection
    * to the serial port is closed automatically.
    * @throws `TypeError` - When a parameter has an invalid type.
    * @throws `RangeError` - When a parameter has an invalid value.
    * @throws `SyntaxError` - When a mandatory parameter is missing or an
    * optional parameter is not applicable.
    */
  constructor (options = {}) {
    super()
    this._options = {
      timeout: 5
    }
    const optionParser = new homebridgeLib.OptionParser(this._options)
    optionParser.stringKey('serialPort')
    optionParser.boolKey('dsmr22')
    optionParser.intKey('timeout', 5, 120)
    optionParser.parse(options)
    if (this._options.dsmr22 && this._options.timeout < 50) {
      this._options.timeout = 50
    }
  }

  /** Find the path to the serial port device of the USB P1 converter cable.
    * @returns {string} The path to the (first) serial port device that
    * matches the USB signature of a USB P1 converter cable.
    * @throws `Error` - When no USB P1 converter cable was found.
    */
  async _findPort () {
    if (this._options.serialPort != null) {
      return this._options.serialPort
    }
    const ports = await P1Client.findPorts()
    /** Emitted when serial port devices are discovered.
      * @event P1Client#ports
      * @param {Object[]} ports - The discovered serial ports.
      */
    this.emit('ports', ports)
    for (const port of ports) {
      if (P1Client.isP1(port)) {
        return port.path
      }
    }
    throw new Error('USB P1 converter cable not found')
  }

  _toHost (serialPort) {
    try {
      return homebridgeLib.OptionParser.toHost('serialPort', serialPort)
    } catch (error) {
      return {}
    }
  }

  /** Open the connection to the serial port.
    *
    * When the connection has been established, an `open` event is emitted.
    * When no data has been received for `options.timeout` seconds, the
    * connection is closed automatically.
    * @throws `Error` - When serial port cannot be found or opened.
    */
  async open () {
    const serialPort = this._options.serialPort != null
      ? this._options.serialPort
      : await this._findPort()
    return new Promise((resolve, reject) => {
      const { hostname, port } = this._toHost(serialPort)
      if (hostname != null && port != null) {
        this.p1 = net.createConnection(port, hostname, () => {
          this.emit('open', serialPort)
          this._setTimeout()
          resolve(serialPort)
        })
        this.p1.close = this.p1.destroy
      } else {
        const options = this._options.dsmr22
          ? { baudRate: 9600, dataBits: 7, parity: 'even' } // 9600 7E1
          : { baudRate: 115200 } // 115200 8N1
        options.path = serialPort
        this.p1 = new SerialPort(options, (error) => {
          if (error) {
            return reject(error)
          }
          /** Emitted when the connection to the serial port is opened.
            * @event P1Client#open
            * @param {string} serialPort
            */
          this.emit('open', serialPort)
          this._setTimeout()
          resolve(serialPort)
        })
      }

      this.parser = new ReadlineParser({ delimiter: '/' })
      this.parser.on('data', (telegram) => { this.parseTelegram(telegram) })

      this.p1
        .on('data', () => { this._setTimeout() })
        .on('close', () => {
          this.p1.unpipe(this.parser)
          this.p1.removeAllListeners()
          delete this.p1
          this.parser.removeAllListeners()
          delete this.parser
          /** Emitted when the connection to the serial port is closed.
            * @event P1Client#close
            * @param {string} serialPort
            */
          this.emit('close', serialPort)
        })
        .on('error', (error) => {
          /** Emitted when an error occurs.
            * @event P1Client#error
            * @param {Error} error
            */
          this.emit('error', error)
        })
        .pipe(this.parser)
    })
  }

  /** Check if the connection to the serial port is open.
    */
  isOpen () {
    return this.p1 != null
  }

  /** Close the connection to the serial port.
    */
  async close () {
    if (this.p1 != null) {
      this.p1.close()
    }
  }

  /** Set a new timeout on receiving the next telegram.
    *
    * Any existing timeout is cancelled, before the new timeout is set.
    * When no telegram has been received for `options.timeout` seconds, the
    * connection to the serial port is closed automatically.
    */
  _setTimeout () {
    if (this.timeout != null) {
      clearTimeout(this.timeout)
    }
    this.timeout = setTimeout(() => {
      if (this.p1 != null) {
        this.emit(
          'error', new Error(`no data received in ${this._options.timeout}s`)
        )
        this.p1.close()
      }
    }, this._options.timeout * 1000)
  }

  crc16 (s) {
    const b = Buffer.from(s, 'utf8')
    let crc = 0

    for (let i = 0; i < b.length; i++) {
      crc ^= b[i]
      for (let j = 8; j > 0; j--) {
        if ((crc & 0x0001) !== 0) {
          crc >>= 1
          crc ^= 0xA001
        } else {
          crc >>= 1
        }
      }
    }
    return crc
  }

  /** Parse a telegram.
    *
    * Normally this method is called automatically, when a telegram is received
    * from the P1 interface.
    * It can also be called manually to have P1Cient emit events for a fake
    * telegram (e.g. for testing).
    * @params {!string} telegram - The telegram.
    */
  parseTelegram (telegram) {
    try {
      // Validate telegram.
      if (telegram == null || typeof telegram !== 'string') {
        this.emit('warning', 'ignoring unsupported telegram')
        return
      }
      const header = telegram.match(/(.+)\r\n\r\n/)
      const footer = telegram.match(/(!)([0-9A-F]{4})?\r\n/)
      if (header == null || footer == null) {
        this.emit('warning', 'ignoring invalid telegram')
        return
      }
      if (footer[2] != null) {
        const checksum = parseInt(footer[2], 16)
        const crc = this.crc16('/' + telegram.slice(0, -6))
        if (checksum !== crc) {
          this.emit('warning', 'ignoring telegram with crc error')
          return
        }
      }

      /** Emitted when a telegram has been validated.
        * @event P1Client#telegram
        * @param {string} telegram - The validated telegram.
        */
      this.emit('telegram', telegram)

      // Convert telegram into a raw object.
      const obj = { type: header[1], checksum: footer[2] }
      const lines = telegram.match(/\d+-\d+:\d+\.\d+\.\d+(\(.*\)\r?\n?)+\r\n/g)
      for (const line of lines) {
        const keys = line.match(/\d+-\d+:\d+\.\d+\.\d+/)
        const values = line.match(/\([^)]*\)/g)
        const a = p1Keys[keys[0]]
        if (a == null) {
          /** Emitted when the telegram contains an unknown key.
            * @event P1Client#warning
            * @param {string} message - The warning message.
            */
          this.emit('warning', `${keys[0]}: ignoring unknown key`)
          continue
        }
        for (const id in a) {
          if (a[id].key != null) {
            try {
              obj[a[id].key] = a[id].f(a[id].allValues ? values : values[id])
            } catch (error) {
              const value = a[id].allValues ? values.join('') : values[id]
              this.emit(
                'warning', `${keys[0]}: ignoring unknown value ${value}`
              )
            }
          }
        }
      }

      /** Emitted when a telegram has been parsed.
        * @event P1Client#rawData
        * @param {Object} rawData - The telegram converted 1:1 to a flat obect.
        */
      this.emit('rawData', obj)

      // Convert the flat object into a cooked object.
      const be = obj.version_be != null
      const low = be ? 2 : 1
      const normal = be ? 1 : 2
      const tariff = obj.tariff === low ? 'low' : 'normal'
      const result = {
        type: obj.type,
        version: be ? obj.version_be : obj.version == null ? '2.2' : obj.version,
        msg_text: obj.msg_text,
        msg_num: obj.msg_num,
        electricity: {
          id: obj.id.trim(),
          lastupdated: obj.lastupdated,
          tariff,
          consumption: {
            low: obj['consumption_t' + low],
            normal: obj['consumption_t' + normal]
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
          tariff,
          consumption: {
            low: obj['consumption_back_t' + low],
            normal: obj['consumption_back_t' + normal]
          },
          power: obj.power_back,
          l1: { power: obj.l1_power_back }
        }
      }
      if (obj.l2_power != null && obj.l3_power != null) {
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
        result[obj.d2_type] = {
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
      /** Emitted when a telegram has been parsed.
        * @event P1Client#data
        * @param {Object} data - The telegram converted an object with
        * nested objects.
        */
      this.emit('data', result)
    } catch (error) {
      this.emit('error', error)
    }
  }
}

module.exports = P1Client
