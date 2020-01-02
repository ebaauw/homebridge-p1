// homebridge-p1/lib/P1Service.js
// Copyright © 2020 Erik Baauw. All rights reserved.
//
// Homebridge plugin for DSMR end-consumer (P1) interface.

'use strict'

module.exports = {
  setHomebridge: setHomebridge,
  P1Service: P1Service
}

// ===== Homebridge ============================================================

// let Service
// let Characteristic
let eve
// let my

function setHomebridge (homebridge, _my, _eve) {
  // Service = homebridge.hap.Service
  // Characteristic = homebridge.hap.Characteristic
  eve = _eve
  // my = _my
}

// ===== P1Accessory =============================================================

function P1Service (platform, service, data) {
  this.log = platform.log
  this.service = service
  this.name = service.displayName

  if (data.power != null) {
    this.service.addCharacteristic(eve.Characteristics.CurrentConsumption)
  }
  if (data.current != null) {
    this.service.addCharacteristic(eve.Characteristics.ElectricCurrent)
  }
  if (data.voltage != null) {
    this.service.addCharacteristic(eve.Characteristics.Voltage)
  }
  this.state = {}
}

P1Service.prototype.check = function (data) {
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
  if (
    data != null && data.current != null &&
    data.current !== this.state.current
  ) {
    if (this.state.current != null) {
      this.log.info(
        '%s: set homekit electric current from %s A to %s A', this.Name,
        this.state.current, data.current
      )
    }
    this.state.current = data.current
    this.service.updateCharacteristic(
      eve.Characteristics.ElectricCurrent, this.state.current
    )
  }
  if (
    data != null && data.voltage != null &&
    data.voltage !== this.state.voltage
  ) {
    if (this.state.voltage != null) {
      this.log.info(
        '%s: set homekit voltage from %s V to %s V', this.name,
        this.state.voltage, data.voltage
      )
    }
    this.state.voltage = data.voltage
    this.service.updateCharacteristic(
      eve.Characteristics.Voltage, this.state.voltage
    )
  }
}
