// homebridge-p1/lib/P1Service.js
// Copyright © 2018-2025 Erik Baauw. All rights reserved.
//
// Homebridge plugin for DSMR end-consumer (P1) interface.

import { timeout } from 'homebridge-lib'
import { ServiceDelegate } from 'homebridge-lib/ServiceDelegate'

function dateToString (d) {
  const date = d == null ? new Date() : new Date(d)
  return String(date).slice(0, 24)
}

class P1Service extends ServiceDelegate {
  constructor (p1Accessory, data, subtype = '') {
    super(p1Accessory, {
      name: p1Accessory.name + (subtype === '' ? '' : ' ' + subtype),
      Service: p1Accessory.Services.hap.Outlet,
      subtype
    })
    this.addCharacteristicDelegate({
      key: 'on',
      Characteristic: this.Characteristics.hap.On,
      value: false
    }).on('didSet', async (value) => {
      if (value) {
        await timeout(50)
        this.values.on = false
      }
    })
  }

  static get Electricity () { return Electricity }
  static get Phase () { return Phase }
  static get Peak () { return Peak }
  static get Gas () { return Gas }
  static get Water () { return Water }
}

class Details extends ServiceDelegate {
  constructor (p1Accessory, params) {
    super(p1Accessory, {
      name: params.name,
      Service: p1Accessory.Services.my.Resource,
      subtype: params.subtype
    })
    this.addCharacteristicDelegate({
      key: 'labelIndex',
      Characteristic: this.Characteristics.hap.LabelIndex,
      silent: true,
      value: params.index
    })
  }
}

class Electricity extends P1Service {
  constructor (p1Accessory, data) {
    super(p1Accessory, data)
    this.addCharacteristicDelegate({
      key: 'totalConsumption',
      Characteristic: this.Characteristics.eve.TotalConsumption
    })
    this.addCharacteristicDelegate({
      key: 'consumption',
      Characteristic: this.Characteristics.eve.Consumption
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
      key: 'totalConsumptionNormal',
      Characteristic: this.Characteristics.my.TotalConsumptionNormal
    })
    this.addCharacteristicDelegate({
      key: 'totalConsumptionLow',
      Characteristic: this.Characteristics.my.TotalConsumptionLow
    })
    this.addCharacteristicDelegate({
      key: 'tariff',
      Characteristic: this.Characteristics.my.Tariff
    })
    if (this.name === 'Electricity') {
      if (data.avg_power != null) {
        this.addCharacteristicDelegate({
          key: 'averageConsumption',
          Characteristic: this.Characteristics.my.AverageConsumption,
          unit: ' W',
          value: data.avg_power
        })
        this.addCharacteristicDelegate({
          key: 'airPressure',
          Characteristic: this.Characteristics.eve.AirPressure,
          unit: ' W',
          props: { minValue: 0, maxValue: 12000, minStep: 0.1 },
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
    this.values.totalConsumption =
      Math.round(1000 * (data.consumption.low + data.consumption.normal)) / 1000
    this.values.totalConsumptionNormal = data.consumption.normal
    this.values.totalConsumptionLow = data.consumption.low
    this.values.tariff = data.tariff
    this.values.consumption = data.power
    if (data.avg_power != null) {
      this.values.averageConsumption = data.avg_power
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
    this.values.lastUpdated = dateToString(data.lastupdated)
  }
}

class Phase extends Details {
  constructor (p1Accessory, data, index) {
    super(p1Accessory, {
      name: p1Accessory.name + ' Phase ' + index,
      subtype: 'L' + index,
      index
    })
    this.addCharacteristicDelegate({
      key: 'consumption',
      Characteristic: this.Characteristics.eve.Consumption
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
    this.values.consumption = data.power
    if (data.current != null) {
      this.values.current = data.current
    }
    if (data.voltage != null) {
      this.values.voltage = data.voltage
    }
  }
}

class Peak extends Details {
  constructor (p1Accessory, data, index) {
    super(p1Accessory, {
      name: p1Accessory.name + ' Peak ' + index,
      subtype: 'P' + index,
      index: index + 4
    })
    this.addCharacteristicDelegate({
      key: 'consumption',
      Characteristic: this.Characteristics.eve.Consumption
    })
    this.addCharacteristicDelegate({
      key: 'observationTime',
      Characteristic: this.Characteristics.eve.ObservationTime
    })
    this.check(data)
  }

  check (data) {
    this.values.consumption = data.power
    this.values.observationTime = dateToString(data.time)
  }
}

class Gas extends P1Service {
  constructor (p1Accessory, data) {
    super(p1Accessory, data)
    this.addCharacteristicDelegate({
      key: 'totalConsumption',
      Characteristic: this.Characteristics.eve.TotalConsumption,
      unit: ' m³'
    })
    this.addCharacteristicDelegate({
      key: 'consumption',
      unit: ' l/h',
      Characteristic: this.Characteristics.eve.Consumption
    })
    this.addCharacteristicDelegate({
      key: 'lastUpdated',
      Characteristic: this.Characteristics.my.LastUpdated,
      silent: true
    })
    this.check(data)
  }

  check (data) {
    this.values.totalConsumption = data.consumption
    const date = data.lastupdated == null ? new Date() : new Date(data.lastupdated)
    this.values.lastUpdated = String(date).slice(0, 24)
  }
}

class Water extends P1Service {
  constructor (p1Accessory, data) {
    super(p1Accessory, data)
    this.addCharacteristicDelegate({
      key: 'totalConsumption',
      Characteristic: this.Characteristics.eve.TotalConsumption,
      unit: ' m³'
    })
    this.addCharacteristicDelegate({
      key: 'consumption',
      unit: ' l/h',
      Characteristic: this.Characteristics.eve.Consumption
    })
    this.addCharacteristicDelegate({
      key: 'lastUpdated',
      Characteristic: this.Characteristics.my.LastUpdated,
      silent: true
    })
    this.check(data)
  }

  check (data) {
    this.values.totalConsumption = data.consumption
    const date = data.lastupdated == null ? new Date() : new Date(data.lastupdated)
    this.values.lastUpdated = String(date).slice(0, 24)
  }
}

export { P1Service }
