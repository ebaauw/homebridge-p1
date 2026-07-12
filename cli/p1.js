#!/usr/bin/env node

// homebridge-p1/cli/p1.js
//
// Homebridge plugin for DSMR end-consumer (P1) interface.
// Copyright © 2020-2026 Erik Baauw. All rights reserved.

import { createRequire } from 'node:module'

import { P1Tool } from 'hb-p1-tools/P1Tool'

const require = createRequire(import.meta.url)
const packageJson = require('../package.json')

new P1Tool(packageJson).main()
