// homebridge-p1/index.js
// Copyright © 2018-2024 Erik Baauw. All rights reserved.
//
// Homebridge plugin for DSMR end-consumer (P1) interface.

import { createRequire } from 'node:module'

import { P1Platform } from './lib/P1Platform.js'

const require = createRequire(import.meta.url)
const packageJson = require('./package.json')

function main (homebridge) {
  P1Platform.loadPlatform(homebridge, packageJson, 'P1', P1Platform)
}

export { main as default }
