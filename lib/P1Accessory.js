// homebridge-p1/lib/P1Accessory.js
// Copyright © 2018-2023 Erik Baauw. All rights reserved.
//
// Homebridge plugin for DSMR end-consumer (P1) interface.

'use strict'

const homebridgeLib = require('homebridge-lib')
const P1Service = require('./P1Service')

class P1Accessory extends homebridgeLib.AccessoryDelegate {
  constructor (platform, name, data) {
    const params = {
      name,
      id: data.id,
      manufacturer: 'homebridge-p1',
      model: 'homebridge-p1',
      category: platform.Accessory.Categories.Sensor
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
  static get Water () { return Water }
}

class Electricity extends P1Accessory {
  constructor (platform, data, name = 'Electricity') {
    super(platform, name, data)
    this.service = new P1Service.Electricity(this, data)
    if (name === 'Electricity') {
      this.manageLogLevel(this.service.characteristicDelegate('logLevel'))
    } else {
      this.inheritLogLevel(platform.electricity)
    }
    if (data.l2 != null && data.l3 != null) {
      this.serviceL1 = new P1Service.Phase(this, data.l1, 'L1')
      this.serviceL2 = new P1Service.Phase(this, data.l2, 'L2')
      this.serviceL3 = new P1Service.Phase(this, data.l3, 'L3')
    }
    this.historyService = new homebridgeLib.ServiceDelegate.History(
      this, {
        consumptionDelegate: this.service.characteristicDelegate('consumption'),
        airPressureDelegate: this.service.characteristicDelegate('airPressure')
      }
    )
  }
}

class Gas extends P1Accessory {
  constructor (platform, data) {
    super(platform, 'Gas', data)
    this.service = new P1Service.Gas(this, data)
    this.historyService = new homebridgeLib.ServiceDelegate.History(
      this, {
        consumptionDelegate: this.service.characteristicDelegate('consumption'),
        computedPowerDelegate: this.service.characteristicDelegate('power')
      }
    )
    this.inheritLogLevel(platform.electricity)
  }
}

class Water extends P1Accessory {
  constructor (platform, data) {
    super(platform, 'Water', data)
    this.service = new P1Service.Water(this, data)
    this.historyService = new homebridgeLib.ServiceDelegate.History(
      this, {
        consumptionDelegate: this.service.characteristicDelegate('consumption'),
        computedPowerDelegate: this.service.characteristicDelegate('power')
      }
    )
    this.inheritLogLevel(platform.electricity)
  }
}

module.exports = P1Accessory
