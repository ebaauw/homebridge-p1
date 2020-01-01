# homebridge-p1
[![npm](https://img.shields.io/npm/dt/homebridge-p1.svg)](https://www.npmjs.com/package/homebridge-p1) [![npm](https://img.shields.io/npm/v/homebridge-p1.svg)](https://www.npmjs.com/package/homebridge-p1)
[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)

## Homebridge plugin for DSMR end-consumer (P1) interface
Copyright © 2018-2020 Erik Baauw. All rights reserved.

This [homebridge](https://github.com/nfarina/homebridge) plugin exposes a smart meter to Apple's [HomeKit](http://www.apple.com/ios/home/), using the end-consumer (P1) interface of the [Dutch Smart Meter Requirements (DSMR)](https://www.netbeheernederland.nl/_upload/Files/Slimme_meter_15_a727fce1f1.pdf).  It provides insight from HomeKit into your actual and historic energy consumption.

The smart meter sends a push notification ("telegram" in DSMR speak), every second, updating the electricity consumption almost in real time.  Gas consumption is updated once every five minutes.  The homebridge-p1 plugin maintains the historic consumption.  It exposes two HomeKit accessories, one for electricity and one for gas, aptly named _Electricity_ and _Gas_.  Both accessories expose `Total Consumption` and (Current) `Consumption`, just like an Elgato Eve Energy, enabling Elgato's [Eve](https://www.elgato.com/en/eve/eve-app) app to display the consumption history.  Eve computes the `Total Cost` and `Projected Cost`.

### Prerequisites
You need a smart meter that complies to DSMR (currently DSMR 5.0 and DSMR 2.2+ are tested).  The companies maintaining the electricity and natural gas networks in the Netherlands, united in [Netbeer Nederland](https://www.netbeheernederland.nl) are [replacing](https://www.onsenergie.net/slimme-meter/) existing electricity and gas meters with smart meters.  In my home, they installed a [Landys +Gyr E350 (ZCF1100)](https://www.landisgyr.eu/product/landisgyr-e350-electricity-meter-new-generation/).

You need a cable to connect the smart meter's P1 port to a USB port.  I got mine [here](https://www.sossolutions.nl/slimme-meter-kabel), but you could also make one yourself, as described [here](http://gejanssen.com/howto/Slimme-meter-uitlezen/).  The cable is quite short (~1m) but you can extend it using a regular USB extension cable (female-A to A).

You need a server to run homebridge.  This can be anything running [Node.js](https://nodejs.org): from a Raspberry Pi, a NAS system, or an always-on PC running Linux, macOS, or Windows.  See the [homebridge Wiki](https://github.com/nfarina/homebridge/wiki) for details.  I run homebridge-p1 on a Raspberry Pi 3 model B.  
I recommend using wired Ethernet to connect the server running homebridge and the AppleTV.

The user running homebridge needs privileges to list the serial port devices and to open the serial port device for the P1 cable.
Under Raspbian, user `pi` has these privileges by default.
If you run homebridge under a different user, make sure it's member of the `dialout` group, and, for Buster, of the `gpio` group.

To interact with HomeKit, you need Siri or a HomeKit app on an iPhone, Apple Watch, iPad, iPod Touch, or Apple TV (4th generation or later).  I recommend to use the latest released versions of iOS, watchOS, and tvOS.  
Please note that Siri and even Apple's [Home](https://support.apple.com/en-us/HT204893) app still provide only limited HomeKit support.  Particularly, it does not support custom HomeKit services and characteristics.  To use homebridge-p1, you need some other HomeKit app, like Elgato's [Eve](https://www.elgato.com/en/eve/eve-app) app (free) or Matthias Hochgatterer's [Home](http://selfcoded.com/home/) app (paid).  
For HomeKit automation, you need to setup an Apple TV (4th generation or later) or iPad as [Home Hub](https://support.apple.com/en-us/HT207057).

### Installation
The homebridge-p1 plugin obviously needs homebridge, which, in turn needs Node.js.  I've followed these steps to set it up:
- Install the latest v10 LTS version of Node.js.  On a Raspberry Pi, use the 10.x [Debian package](https://nodejs.org/en/download/package-manager/#debian-and-ubuntu-based-linux-distributions). On other platforms, download and run the [10.x.x LTS](https://nodejs.org) installer.  These installations include the `npm` package manager;
- On macOS, make sure `/usr/local/bin` is in your `$PATH`, as `node`, `npm`, and, later, `homebridge` install there.  On a Raspberry Pi, these install to `/usr/bin`;
- You might want to update `npm` through:
  ```
  $ sudo npm -g i npm@latest
  ```
- Install homebridge through
  ```
  $ sudo npm -g i homebridge
  ```
  Follow the instructions on [GitHub](https://github.com/nfarina/homebridge#installation) to create a `config.json` in `~/.homebridge`, as described;
- Install the homebridge-p1 plugin through:
  ```
  $ sudo npm -g i homebridge-p1 --unsafe-perm
  ```
- Edit `~/.homebridge/config.json` and add the `P1` platform provided by homebridge-p1:
  ```json
  "platforms": [
    {
      "platform": "P1"
    }
  ]
  ```

### Configuration
Homebridge-p1 should detect the USB serial cable automatically.  In case it doesn't or when you have multiple USB serial devices, you can specify the serialport in config.json:
```json
"platforms": [
  {
    "platform": "P1",
    "serialport": "/dev/ttyUSB0"
  }
]
```
If homebridge-p1 doesn't receive any data and you have a meter with an older DSMR version, you might need to specify:
```json
"platforms": [
  {
    "platform": "P1",
    "serialport": "/dev/ttyUSB0",
    "dsmr22": true
  }
]
```
If homebridge-p1 receives data too late (i.e. after the homebridge server has started) no accessories will be exposed to HomeKit.  In this case, set `"timeout"` in config.json and restart homebridge.  This parameter specifies the number of seconds homebridge-p1 waits for data, before giving up and letting homebridge startup continue without any P1 accessories.  Note that accessories from other plugins will not be reachable while homebridge-p1 waits for data, so you want to set `"timeout"` as low as possible, while keeping in mind a telegram might be lost due to communication glitches.  The default of `"timeout": 5` assumes the meter sends a telegram every second.  DSMR v2.2 meters only send a telegram every 10 seconds, so when `"dsmr22": true` is set, a default `"timeout": 50` is used.

### Caveats
Exposing the smart meter to HomeKit is a bit of a hack, lacking proper HomeKit support for smart meters.  Also, Eve lacks proper support for gas consumption.  The following limitations apply:
- The Electricity consumption is the combined consumption under Normal and Low tariff.  If you have a dual-tariff contract, the cost computed by Eve will be inaccurate;
- The Gas consumption is actually in m³, but Eve displays kWh.  If homebridge-p1 would expose different characteristics for gas consumption, Eve would display the correct units, but not the history.  To see the correct cost for Gas, you need to change the _Energy Cost_ under _Settings_ in Eve to match you Gas rate;
- Eve doesn't take into account fixed (subscription) costs, so the cost displayed is only the variable cost.
