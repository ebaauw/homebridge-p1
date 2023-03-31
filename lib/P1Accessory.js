// homebridge-p1/lib/P1Accessory.js
// Copyright © 2018-2023 Erik Baauw. All rights reserved.
//
// Homebridge plugin for DSMR end-consumer (P1) interface.

'use strict'

const homebridgeLib = require('homebridge-lib')
const P1Service = require('./P1Service')

class P1Accessory extends homebridgeLib.AccessoryDelegate {
  constructor (platform, name, data) {
    super(platform, {
      name,
      id: data.id,
      manufacturer: 'homebridge-p1',
      model: 'homebridge-p1',
      category: platform.Accessory.Categories.Sensor
    })
    setImmediate(() => {
      this.emit('initialised')
    })
  }

  check (data) {
    this.service.check(data)
    if ((data.l2 != null && data.l3 != null) || data.avg_power_peaks != null) {
      if (this.details == null) {
        this.details = new ElectricityDetails(this, data)
      } else {
        this.details.check(data)
      }
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
      this.manageLogLevel(this.service.characteristicDelegate('logLevel'), true)
    } else {
      this.inheritLogLevel(platform.electricity)
    }
    this.historyService = new homebridgeLib.ServiceDelegate.History(
      this, {
        totalConsumptionDelegate: this.service.characteristicDelegate('totalConsumption'),
        airPressureDelegate: this.service.characteristicDelegate('airPressure')
      }
    )
    this.check(data)
  }
}

class ElectricityDetails extends homebridgeLib.AccessoryDelegate {
  constructor (accessory, data) {
    super(accessory.platform, {
      name: accessory.name,
      id: data.id + 'D',
      manufacturer: 'homebridge-p1',
      model: 'homebridge-p1',
      category: accessory.platform.Accessory.Categories.Sensor
    })
    this.inheritLogLevel(accessory.platform.electricity)
    this.dummyService = new homebridgeLib.ServiceDelegate.Dummy(this)
    this.peakServices = []
    this.check(data)
    setImmediate(() => {
      this.emit('initialised')
    })
  }

  check (data) {
    if (data.l2 != null && data.l3 != null) {
      if (this.serviceL1 == null) {
        this.serviceL1 = new P1Service.Phase(this, data.l1, 1)
        this.serviceL2 = new P1Service.Phase(this, data.l2, 2)
        this.serviceL3 = new P1Service.Phase(this, data.l3, 3)
      } else {
        this.serviceL1.check(data.l1)
        this.serviceL2.check(data.l2)
        this.serviceL3.check(data.l3)
      }
    }
    if (data.avg_power_peaks != null) {
      for (const i in data.avg_power_peaks) {
        if (this.peakServices[i] == null) {
          this.peakServices.push(
            new P1Service.Peak(this, data.avg_power_peaks[i], i)
          )
        } else {
          this.peakServices[i].check(data.avg_power_peaks[i])
        }
      }
    }
  }
}

class Gas extends P1Accessory {
  constructor (platform, data) {
    super(platform, 'Gas', data)
    this.service = new P1Service.Gas(this, data)
    this.historyService = new homebridgeLib.ServiceDelegate.History(
      this, {
        totalConsumptionDelegate: this.service.characteristicDelegate('totalConsumption'),
        computedConsumptionDelegate: this.service.characteristicDelegate('consumption')
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
        totalConsumptionDelegate: this.service.characteristicDelegate('totalConsumption'),
        computedConsumptionDelegate: this.service.characteristicDelegate('consumption')
      }
    )
    this.inheritLogLevel(platform.electricity)
  }
}

module.exports = P1Accessory
