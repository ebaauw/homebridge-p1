// homebridge-p1/index.js
// Copyright © 2018-2024 Erik Baauw. All rights reserved.
//
// Homebridge plugin for DSMR end-consumer (P1) interface.

'use strict'

const P1Platform = require('./lib/P1Platform')
const packageJson = require('./package.json')

module.exports = function (homebridge) {
  P1Platform.loadPlatform(homebridge, packageJson, 'P1', P1Platform)
}
