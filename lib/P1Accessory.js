// homebridge-p1/lib/P1Accessory.js
// Copyright © 2018-2020 Erik Baauw. All rights reserved.
//
// Homebridge plugin for DSMR end-consumer (P1) interface.

'use strict'

const homebridgeLib = require('homebridge-lib')
const P1Service = require('./P1Service')

class P1Accessory extends homebridgeLib.AccessoryDelegate {
  constructor (platform, name, data) {
    const params = {
      name: name,
      id: data.id,
      manufacturer: 'homebridge-p1',
      model: 'homebridge-p1',
      firmware: '1.0',
      category: platform.Accessory.Categories.Sensor,
      inheritLogLevel: name !== 'Electricity'
    }
    super(platform, params)
    setImmediate(() => {
      this.emit('initialised')
    })
  }

  check (data) {
    this.service.check(data)
    if (data.l2 != null && data.l3 != null) {
      this.serviceL1.check(data.l1)
      this.serviceL2.check(data.l2)
      this.serviceL3.check(data.l3)
    }
  }

  static get Electricity () { return Electricity }

  static get Gas () { return Gas }
}

class Electricity extends P1Accessory {
  constructor (platform, data, name = 'Electricity') {
    super(platform, name, data)
    this.service = new P1Service.Electricity(this, data)
    if (data.l2 != null && data.l3 != null) {
      this.serviceL1 = new P1Service.Phase(this, data.l1, 'L1')
      this.serviceL2 = new P1Service.Phase(this, data.l2, 'L2')
      this.serviceL3 = new P1Service.Phase(this, data.l3, 'L3')
    }
    this.historyService = new homebridgeLib.ServiceDelegate.History.Consumption(
      this, {},
      this.service.characteristicDelegate('consumption')
    )
    if (this.platform.config.button) {
      this.buttonService = new P1Service.Button(this)
    }
  }
}

class Gas extends P1Accessory {
  constructor (platform, data) {
    super(platform, 'Gas', data)
    this.service = new P1Service.Gas(this, data)
    this.historyService = new homebridgeLib.ServiceDelegate.History.Consumption(
      this, {},
      this.service.characteristicDelegate('consumption')
    )
    if (this.platform.config.button) {
      this.buttonService = new P1Service.Button(this)
    }
  }
}

module.exports = P1Accessory
