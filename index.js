// homebridge-p1/index.js
// Copyright © 2018 Erik Baauw. All rights reserved.
//
// Homebridge plugin for DSMR end-consumer (P1) interface.

'use strict'

const P1PlatformModule = require('./lib/P1Platform')
const P1Platform = P1PlatformModule.P1Platform

module.exports = function (homebridge) {
  P1PlatformModule.setHomebridge(homebridge)
  homebridge.registerPlatform('homebridge-p1', 'P1', P1Platform)
}
