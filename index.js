// homebridge-p1/index.js
// Copyright © 2018-2019 Erik Baauw. All rights reserved.
//
// Homebridge plugin for DSMR end-consumer (P1) interface.

'use strict'

const P1Platform = require('./lib/P1Platform')

module.exports = function (homebridge) {
  homebridge.registerPlatform('homebridge-p1', 'P1', P1Platform)
}
