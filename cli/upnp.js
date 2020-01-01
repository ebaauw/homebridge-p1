#!/usr/bin/env node

// homebridge-p1/cli/upnp.js
// Copyright © 2018-2020 Erik Baauw. All rights reserved.
//
// Homebridge plugin for DSMR end-consumer (P1) interface.

'use strict'

const homebridgeLib = require('homebridge-lib')

new homebridgeLib.UpnpCommand().main()
