// homebridge-p1/lib/WSPlatform.js
// Copyright © 2018 Erik Baauw. All rights reserved.
//
// Homebridge plugin for DSMR end-consumer (P1) interface.

'use strict'

const fakegatoHistory = require('fakegato-history')
const moment = require('moment')

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
}

// ===== P1Accessory =============================================================

function P1Accessory (platform, name, telegram) {
  this.log = platform.log
  this.platform = platform
  this.name = name
  this.displayName = name
  this.uuid_base = name
  this.infoService = new Service.AccessoryInformation()
  this.infoService
    .updateCharacteristic(Characteristic.Manufacturer, 'homebridge-p1')
    .updateCharacteristic(Characteristic.Model, 'homebridge-p1')
    .updateCharacteristic(Characteristic.SerialNumber, telegram.id)
    .updateCharacteristic(Characteristic.FirmwareRevision, telegram.version)

  this.service = new Service.Switch(this.name)
  this.service.getCharacteristic(Characteristic.On)
    .setProps({perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]})
    .updateValue(1)
  this.service.addCharacteristic(eve.Characteristic.CurrentConsumption)
  this.service.addCharacteristic(eve.Characteristic.TotalConsumption)
  this.service.addCharacteristic(my.Characteristic.LastUpdated)
  this.service.addCharacteristic(eve.Characteristic.ElectricalCurrent)
  this.service.addCharacteristic(eve.Characteristic.Voltage)
  this.historyService = new HistoryService('energy', this, {
    storage: 'fs'
  })
  this.entry = {power: 0}
}

P1Accessory.prototype.getServices = function () {
  return [
    this.infoService,
    this.service,
    this.historyService
  ]
}

P1Accessory.prototype.handleTelegram = function (telegram) {
  this.service
    .updateCharacteristic(
      eve.Characteristic.CurrentConsumption, telegram.eletricity.power
    )
    .updateCharacteristic(
      eve.Characteristic.TotalConsumption,
      telegram.consumption.low + telegram.consumption.normal
    )
    .updateCharacteristic(my.Characteristic.LastUpdated, telegram.lastupdated)
    .updateCharacteristic(
      eve.Characteristic.ElectricalCurrent, telegram.l1.current
    )
    .updateCharacteristic(eve.Characteristic.Voltage, telegram.l1.voltage)
  this.entry.time = moment().unix()
  this.entry.power = telegram.power
  this.historyService.addEntry(this.entry)
}
