// homebridge-p1/lib/P1Service.js
// Copyright © 2018-2023 Erik Baauw. All rights reserved.
//
// Homebridge plugin for DSMR end-consumer (P1) interface.

'use strict'

const homebridgeLib = require('homebridge-lib')

class P1Service extends homebridgeLib.ServiceDelegate {
  constructor (p1Accessory, data, subtype = '') {
    const params = {
      name: p1Accessory.name + (subtype === '' ? '' : ' ' + subtype),
      Service: p1Accessory.Services.hap.Outlet,
      subtype
    }
    super(p1Accessory, params)
    this.addCharacteristicDelegate({
      key: 'on',
      Characteristic: this.Characteristics.hap.On,
      value: false
    }).on('didSet', async (value) => {
      if (value) {
        await homebridgeLib.timeout(50)
        this.values.on = false
      }
    })
  }

  static get Electricity () { return Electricity }
  static get Phase () { return Phase }
  static get Gas () { return Gas }
  static get Water () { return Water }
}

class Electricity extends P1Service {
  constructor (p1Accessory, data) {
    super(p1Accessory, data)
    this.addCharacteristicDelegate({
      key: 'consumption',
      Characteristic: this.Characteristics.eve.TotalConsumption
    })
    this.addCharacteristicDelegate({
      key: 'power',
      Characteristic: this.Characteristics.eve.CurrentConsumption
    })
    this.addCharacteristicDelegate({
      key: 'lastUpdated',
      Characteristic: this.Characteristics.my.LastUpdated,
      silent: true
    })
    if (data.l2 == null && data.l3 == null) {
      if (data.l1.current != null) {
        this.addCharacteristicDelegate({
          key: 'current',
          Characteristic: this.Characteristics.eve.ElectricCurrent
        })
      }
      if (data.l1.voltage != null) {
        this.addCharacteristicDelegate({
          key: 'voltage',
          Characteristic: this.Characteristics.eve.Voltage
        })
      }
    }
    this.addCharacteristicDelegate({
      key: 'consumptionNormal',
      Characteristic: this.Characteristics.my.TotalConsumptionNormal
    })
    this.addCharacteristicDelegate({
      key: 'consumptionLow',
      Characteristic: this.Characteristics.my.TotalConsumptionLow
    })
    this.addCharacteristicDelegate({
      key: 'tariff',
      Characteristic: this.Characteristics.my.Tariff
    })
    if (this.name === 'Electricity') {
      if (data.avg_power != null) {
        this.addCharacteristicDelegate({
          key: 'airPressure',
          Characteristic: this.Characteristics.eve.AirPressure,
          unit: ' W',
          props: { minValue: 0, maxValue: 10000, minStep: 0.1 },
          value: data.avg_power
        })
      }
      this.addCharacteristicDelegate({
        key: 'logLevel',
        Characteristic: this.Characteristics.my.LogLevel,
        value: this.accessoryDelegate.logLevel
      })
    }
    this.check(data)
  }

  check (data) {
    this.values.consumption =
      Math.round(1000 * (data.consumption.low + data.consumption.normal)) / 1000
    this.values.consumptionNormal = data.consumption.normal
    this.values.consumptionLow = data.consumption.low
    this.values.tariff = data.tariff
    this.values.power = data.power
    if (data.avg_power != null) {
      this.values.airPressure = data.avg_power
    }
    if (data.l2 == null && data.l3 == null) {
      if (data.l1.current != null) {
        this.values.current = data.l1.current
      }
      if (data.l1.voltage != null) {
        this.values.voltage = data.l1.voltage
      }
    }
    const date = data.lastupdated == null ? new Date() : new Date(data.lastupdated)
    this.values.lastUpdated = String(date).slice(0, 24)
  }
}

class Phase extends P1Service {
  constructor (p1Accessory, data, subtype) {
    super(p1Accessory, data, subtype)
    this.addCharacteristicDelegate({
      key: 'power',
      Characteristic: this.Characteristics.eve.CurrentConsumption
    })
    if (data.current != null) {
      this.addCharacteristicDelegate({
        key: 'current',
        Characteristic: this.Characteristics.eve.ElectricCurrent
      })
    }
    if (data.voltage != null) {
      this.addCharacteristicDelegate({
        key: 'voltage',
        Characteristic: this.Characteristics.eve.Voltage
      })
    }
    this.check(data)
  }

  check (data) {
    this.values.power = data.power
    if (data.current != null) {
      this.values.current = data.current
    }
    if (data.voltage != null) {
      this.values.voltage = data.voltage
    }
  }
}

class Gas extends P1Service {
  constructor (p1Accessory, data) {
    super(p1Accessory, data)
    this.addCharacteristicDelegate({
      key: 'consumption',
      Characteristic: this.Characteristics.eve.TotalConsumption,
      unit: ' m³'
    })
    this.addCharacteristicDelegate({
      key: 'power',
      unit: ' l/h',
      Characteristic: this.Characteristics.eve.CurrentConsumption
    })
    this.addCharacteristicDelegate({
      key: 'lastUpdated',
      Characteristic: this.Characteristics.my.LastUpdated,
      silent: true
    })
    this.check(data)
  }

  check (data) {
    this.values.consumption = data.consumption
    const date = data.lastupdated == null ? new Date() : new Date(data.lastupdated)
    this.values.lastUpdated = String(date).slice(0, 24)
  }
}

class Water extends P1Service {
  constructor (p1Accessory, data) {
    super(p1Accessory, data)
    this.addCharacteristicDelegate({
      key: 'consumption',
      Characteristic: this.Characteristics.eve.TotalConsumption,
      unit: ' m³'
    })
    this.addCharacteristicDelegate({
      key: 'power',
      unit: ' l/h',
      Characteristic: this.Characteristics.eve.CurrentConsumption
    })
    this.addCharacteristicDelegate({
      key: 'lastUpdated',
      Characteristic: this.Characteristics.my.LastUpdated,
      silent: true
    })
    this.check(data)
  }

  check (data) {
    this.values.consumption = data.consumption
    const date = data.lastupdated == null ? new Date() : new Date(data.lastupdated)
    this.values.lastUpdated = String(date).slice(0, 24)
  }
}

module.exports = P1Service
