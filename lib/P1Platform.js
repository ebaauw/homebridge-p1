// homebridge-p1/lib/WSPlatform.js
// Copyright © 2018 Erik Baauw. All rights reserved.
//
// Homebridge plugin for DSMR end-consumer (P1) interface.

'use strict'

const semver = require('semver')

const homebridgeHueUtils = require('homebridge-hue-utils')
const MyHomeKitTypes = homebridgeHueUtils.MyHomeKitTypes
const EveHomeKitTypes = homebridgeHueUtils.EveHomeKitTypes
const RestClient = homebridgeHueUtils.RestClient
const P1AccessoryModule = require('./P1Accessory')
const P1Accessory = P1AccessoryModule.P1Accessory
const P1Client = require('./P1Client')
const packageJson = require('../package.json')

module.exports = {
  P1Platform: P1Platform,
  setHomebridge: setHomebridge
}

function minVersion (range) {
  let s = range.split(' ')[0]
  while (s) {
    if (semver.valid(s)) {
      break
    }
    s = s.substring(1)
  }
  return s || undefined
}

// ===== Homebridge ============================================================

let homebridgeVersion

function setHomebridge (homebridge) {
  homebridgeVersion = homebridge.serverVersion
  const my = new MyHomeKitTypes(homebridge)
  const eve = new EveHomeKitTypes(homebridge)
  P1AccessoryModule.setHomebridge(homebridge, my, eve)
}

// ===== P1Platform ============================================================

function P1Platform (log, configJson, api) {
  this.log = log
  this.api = api
  this.packageJson = packageJson
  this.configJson = configJson
  this.config = { timeout: 5 }
  for (const key in configJson) {
    const value = configJson[key]
    switch (key.toLowerCase()) {
      case 'name':
        this.config.name = value
        break
      case 'platform':
        break
      default:
        this.log.warn('config.json: warning: %s: ignoring unknown key', key)
        break
    }
  }
  this.identify()
}

P1Platform.prototype.accessories = function (callback) {
  let accessoryList = []
  const npmRegistry = new RestClient({
    host: 'registry.npmjs.org',
    name: 'npm registry'
  })
  npmRegistry.get(packageJson.name).then((response) => {
    if (
      response && response['dist-tags'] &&
      response['dist-tags'].latest !== packageJson.version
    ) {
      this.log.warn(
        'warning: lastest version: %s v%s', packageJson.name,
        response['dist-tags'].latest
      )
    }
  }).catch((err) => {
    this.log.error(err)
  }).then(() => {
    this.p1 = new P1Client()
    this.p1.on('data', (data) => {
      if (this.electricity == null) {
        this.log('%s v%s', data.type, data.version)
        this.electricity = new P1Accessory(this, 'Electricity', data)
        accessoryList.push(this.electricity)
        callback(accessoryList)
      } else {
        this.electricity.check(data)
      }
    })
    this.p1.connect().then((port) => {
      this.log.debug('listening on %s', port)
    }).catch((error) => {
      this.log.error(error.message)
      callback(accessoryList)
    })
  }).catch((error) => {
    this.log.error(error)
    callback(accessoryList) // Not going to help if error was thrown by callback().
  })
}

P1Platform.prototype.identify = function () {
  this.log.info(
    '%s v%s, node %s, homebridge v%s', packageJson.name,
    packageJson.version, process.version, homebridgeVersion
  )
  if (semver.clean(process.version) !== minVersion(packageJson.engines.node)) {
    this.log.warn(
      'warning: not using recommended node version v%s LTS',
      minVersion(packageJson.engines.node)
    )
  }
  if (homebridgeVersion !== minVersion(packageJson.engines.homebridge)) {
    this.log.warn(
      'warning: not using recommended homebridge version v%s',
      minVersion(packageJson.engines.homebridge)
    )
  }
}
