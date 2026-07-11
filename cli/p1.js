#!/usr/bin/env node

// homebridge-p1/cli/ws.js
// Copyright © 2020-2026 Erik Baauw. All rights reserved.
//
// Homebridge plugin for DSMR end-consumer (P1) interface.

import { timeout } from 'hb-lib-tools'
import { CommandLineParser } from 'hb-lib-tools/CommandLineParser'
import { CommandLineTool } from 'hb-lib-tools/CommandLineTool'
import { JsonFormatter } from 'hb-lib-tools/JsonFormatter'
import { OptionParser } from 'hb-lib-tools/OptionParser'

import { P1Client } from '../lib/P1Client.js'
// import * as telegrams from '../lib/telegrams.js'

const { b, u } = CommandLineTool

const usage = `${b('ws')} [${b('-hVDds')}] [${b('-H')} ${u('hostname')}${b(':')}${u('port')}] [${b('-t')} ${u('timeout')}]`
const help = `P1 tool.

Usage: ${usage}

Log data received from the P1 port.

Parameters:
  ${b('-h')}, ${b('--help')}
  Print this help and exit.

  ${b('-V')}, ${b('--version')}
  Print version and exit.
  
  ${b('-D')}, ${b('--debug')}
  Print debug messages.

  ${b('-d')}, ${b('--daemon')}
  Run as daemon.

  ${b('-s')}, ${b('--service')}
  Run as service.  Do not output timestamps.

  ${b('-H')} ${u('hostname')}${b(':')}${u('port')}, ${b('--host=')}${u('hostname')}${b(':')}${u('port')}
  Connect to the serial port over ${b('ser2net')} at ${u('hostname')}${b(':')}${u('port')}.
  Default: connect to the auto discovered P1 USB cable.

  ${b('-t')} ${u('timeout')}, ${b('--timeout=')}${u('timeout')}
  Set timeout to ${u('timeout')} seconds instead of default ${b('15')}.`

class WsTool extends CommandLineTool {
  constructor (pkgJson) {
    super()
    this.pkgJson = pkgJson
    this.usage = usage
    this.options = {
      dsmr22: false,
      timeout: 15
    }
  }

  parseArguments () {
    const parser = new CommandLineParser(this.pkgJson)
    parser
      .help('h', 'help', help)
      .version('V', 'version')
      .debug('D', 'debug', this)
      .flag('d', 'daemon', (key) => { this.options.mode = 'daemon' })
      .flag('s', 'service', (key) => { this.options.mode = 'service' })
      .option('H', 'host', (value, key) => {
        this.options.serialPort = OptionParser.toHost(key, value, true, true)
      })
      .flag('2', 'dsmr22', (key) => { this.options.dsmr22 = true })
      .option('t', 'timeout', (value, key) => {
        this.options.timeout = OptionParser.toInt(key, value, 1, 60, true)
      })
      .parse()
  }

  async _main () {
    this.parseArguments()
    this.p1 = new P1Client({
      dsmr22: this.options.dsmr22,
      logger: this,
      serialPort: this.options.serialPort,
      timeout: this.options.timeout
    })
    const formatter = new JsonFormatter(
      this.options.mode === 'service'
        ? { noWhiteSpace: true, sortKeys: true }
        : { sortKeys: true }
    )
    if (this.options.mode) {
      this.setOptions({ mode: this.options.mode })
    }
    this.p1.on('data', (data) => { this.log(formatter.stringify(data)) })
    try {
      await this.p1.open()
    } catch (error) {
      delete this.p1
      this.fatal(error)
    }
  }

  async main () {
    try {
      await this._main()
    } catch (error) { this.error(error) }
  }

  async destroy () {
    await this.p1?.close()
    await timeout(500)
  }
}

new WsTool().main()
