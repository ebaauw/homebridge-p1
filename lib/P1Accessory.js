// homebridge-p1/lib/P1Accessory.js
// Copyright © 2018-2020 Erik Baauw. All rights reserved.
//
// Homebridge plugin for DSMR end-consumer (P1) interface.

'use strict'

const fakegatoHistory = require('fakegato-history')
const moment = require('moment')
const P1ServiceModule = require('./P1Service')
const P1Service = P1ServiceModule.P1Service

module.exports = {
  setHomebridge: setHomebridge,
  P1Accessory: P1Accessory
}

// ===== Homebridge ============================================================

let Service
let Characteristic
let eve
let my
let HistoryService

function setHomebridge (homebridge, _my, _eve) {
  Service = homebridge.hap.Service
  Characteristic = homebridge.hap.Characteristic
  eve = _eve
  my = _my
  HistoryService = fakegatoHistory(homebridge)
  P1ServiceModule.setHomebridge(homebridge, _my, _eve)
}

// ===== P1Accessory =============================================================

function P1Accessory (platform, name, data) {
  this.log = platform.log
  this.platform = platform
  this.type = name[0]
  this.name = name
  this.uuid_base = data.id
  this.serviceList = []
  this.infoService = new Service.AccessoryInformation()
  this.infoService
    .updateCharacteristic(Characteristic.Manufacturer, 'homebridge-p1')
    .updateCharacteristic(Characteristic.Model, 'homebridge-p1')
    .updateCharacteristic(Characteristic.SerialNumber, data.id)
    .updateCharacteristic(
      Characteristic.FirmwareRevision, this.platform.packageJson.version
    )
  this.serviceList.push(this.infoService)

  this.service = new my.Services.Resource(this.name)
  this.serviceList.push(this.service)
  this.service.addCharacteristic(eve.Characteristics.TotalConsumption)
  this.service.addCharacteristic(my.Characteristics.LastUpdated)
  if (this.type === 'E') {
    this.unit = 'kWh'
    this.service.addCharacteristic(my.Characteristics.TotalConsumptionNormal)
    this.service.addCharacteristic(my.Characteristics.TotalConsumptionLow)
  } else if (this.type === 'G') {
    this.unit = 'm³'
    this.service.getCharacteristic(eve.Characteristics.TotalConsumption)
      .setProps({ unit: this.unit })
  }
  if (data.tariff != null) {
    this.service.addCharacteristic(my.Characteristics.Tariff)
  }
  if (data.power != null) {
    this.service.addCharacteristic(eve.Characteristics.CurrentConsumption)
  }
  if (data.l1 != null && data.l1 != null && data.l1 != null) {
    // Three-phase electricity.
    this.serviceL1 = new my.Service.Resource(this.name + ' L1', 'L1')
    this.serviceList.push(this.serviceL1)
    this.p1ServiceL1 = new P1Service(this.platform, this.serviceL1, data.l1)

    this.serviceL2 = new my.Service.Resource(this.name + ' L2', 'L2')
    this.serviceList.push(this.serviceL2)
    this.p1ServiceL2 = new P1Service(this.platform, this.serviceL2, data.l1)

    this.serviceL3 = new my.Service.Resource(this.name + ' L3', 'L3')
    this.serviceList.push(this.serviceL3)
    this.p1ServiceL3 = new P1Service(this.platform, this.serviceL3, data.l1)
  } else if (data.l1 != null) {
    // Single-phase electricity.
    this.p1ServiceL1 = new P1Service(this.platform, this.service, data.l1)
  }
  this.historyService = new HistoryService('energy', { displayName: this.name }, {
    disableTimer: true,
    storage: 'fs',
    path: this.platform.api.user.storagePath() + '/accessories',
    filename: 'history_' + data.id + '.json'
  })
  this.serviceList.push(this.historyService)
  this.state = {
    history: {}
  }
  this.check(data)
  this.addEntry()
}

P1Accessory.prototype.getServices = function () {
  return [this.infoService, this.service, this.historyService]
}

P1Accessory.prototype.addEntry = function () {
  if (this.state.history.consumption != null) {
    const delta = Math.round(
      1000.0 * (this.state.consumption - this.state.history.consumption)
    )
    const entry = { time: moment().unix(), power: delta * 6.0 }
    this.log('%s: add history entry %j', this.name, entry)
    this.historyService.addEntry(entry)
  }
  this.state.history.consumption = this.state.consumption
}

P1Accessory.prototype.check = function (data) {
  const consumption = this.type === 'E'
    ? Math.round(1000 * (data.consumption.low + data.consumption.normal)) / 1000
    : data.consumption
  if (consumption != null && consumption !== this.state.consumption) {
    if (this.state.consumption != null) {
      this.log.info(
        '%s: set homekit total consumption from %s %s to %s %s', this.name,
        this.state.consumption, this.unit, consumption, this.unit
      )
    }
    this.state.consumption = consumption
    this.service.updateCharacteristic(
      eve.Characteristics.TotalConsumption, this.state.consumption
    )
  }
  if (this.type === 'E') {
    if (data.consumption.normal !== this.state.consumptionNormal) {
      if (this.state.consumptionNormal != null) {
        this.log.info(
          '%s: set homekit total consumption normal from %s kWh to %s kWh',
          this.name, this.state.consumptionNormal, data.consumption.normal
        )
      }
      this.state.consumptionNormal = data.consumption.normal
      this.service.updateCharacteristic(
        my.Characteristics.TotalConsumptionNormal, this.state.consumptionNormal
      )
    }
    if (data.consumption.low !== this.state.consumptionLow) {
      if (this.state.consumptionLow != null) {
        this.log.info(
          '%s: set homekit total consumption low from %s kWh to %s kWh',
          this.name, this.state.consumptionLow, data.consumption.low
        )
      }
      this.state.consumptionLow = data.consumption.low
      this.service.updateCharacteristic(
        my.Characteristics.TotalConsumptionLow, this.state.consumptionLow
      )
    }
  }
  const date = data.lastupdated == null ? new Date() : new Date(data.lastupdated)
  const lastupdated = String(date).substring(0, 24)
  if (lastupdated != null && lastupdated !== this.state.lastupdated) {
    this.state.lastupdated = lastupdated
    this.service.updateCharacteristic(
      my.Characteristics.LastUpdated, this.state.lastupdated
    )
  }
  if (data.power != null && data.power !== this.state.power) {
    if (this.state.power != null) {
      this.log.info(
        '%s: set homekit current consumption from %s W to %s W', this.name,
        this.state.power, data.power
      )
    }
    this.state.power = data.power
    this.service.updateCharacteristic(
      eve.Characteristics.CurrentConsumption, this.state.power
    )
  }
  if (data.tariff != null && data.tariff !== this.state.tariff) {
    if (this.state.tariff != null) {
      this.log.info(
        '%s: set homekit tariff from %s to %s', this.name,
        this.state.tariff, data.tariff
      )
    }
    this.state.tariff = data.tariff
    this.service.updateCharacteristic(
      my.Characteristics.Tariff, this.state.tariff
    )
  }
  if (data.l1 != null && this.p1ServiceL1 != null) {
    this.p1ServiceL1.check(data.l1)
  }
  if (data.l2 != null && this.p1ServiceL2 != null) {
    this.p1ServiceL2.check(data.l2)
  }
  if (data.l3 != null && this.p1ServiceL3 != null) {
    this.p1ServiceL3.check(data.l3)
  }
}
