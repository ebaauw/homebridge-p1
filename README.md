# homebridge-p1
[![npm](https://img.shields.io/npm/dt/homebridge-p1.svg)](https://www.npmjs.com/package/homebridge-p1) [![npm](https://img.shields.io/npm/v/homebridge-p1.svg)](https://www.npmjs.com/package/homebridge-p1)
[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)

## Homebridge plugin for DSMR end-consumer (P1) interface.
Copyright © 2018 Erik Baauw. All rights reserved.

This experimental [homebridge](https://github.com/nfarina/homebridge) plugin exposes a smart meter to Apple's [HomeKit](http://www.apple.com/ios/home/), using the end-consumer (P1) interface of the [Dutch Smart Meter Requirements (DMSR)](https://www.netbeheernederland.nl/_upload/Files/Slimme_meter_15_a727fce1f1.pdf).

Note that this plugin is still under construction.

### Prerequisites
To interact with HomeKit, you need Siri or a HomeKit app on an iPhone, Apple Watch, iPad, iPod Touch, or Apple TV (4th generation or later).  I recommend to use the latest released versions of iOS, watchOS, and tvOS.  
Please note that Siri and even Apple's [Home](https://support.apple.com/en-us/HT204893) app still provide only limited HomeKit support.  To use the full features of homebridge-hue, you might want to check out some other HomeKit apps, like Elgato's [Eve](https://www.elgato.com/en/eve/eve-app) app (free) or Matthias Hochgatterer's [Home](http://selfcoded.com/home/) app (paid).  
For HomeKit automation, you need to setup an Apple TV (4th generation or later) or iPad as [Home Hub](https://support.apple.com/en-us/HT207057).

You need a smart meter that complies to DMSR 5.0.  The companies maintaining the electricity and natural gas networks in the Netherlands, united in [Netbeer Nederland](https://www.netbeheernederland.nl) are [replacing](https://www.onsenergie.net/slimme-meter/) existing electricity and gas meters with smart meters.  In my home, they installed a [Landys +Gyr E350 (ZCF1100)](https://www.landisgyr.eu/product/landisgyr-e350-electricity-meter-new-generation/).

You need a cable to connect the smart meter's P1 port to a USB port.  I got mine [here](https://www.sossolutions.nl/slimme-meter-kabel), but you could also make one yourself, as described [here](http://gejanssen.com/howto/Slimme-meter-uitlezen/).  The cable is quite short (~1m) but you can extend it using a regular USB extension cable (female-A to A).

You need a server to run homebridge.  This can be anything running [Node.js](https://nodejs.org): from a Raspberry Pi, a NAS system, or an always-on PC running Linux, macOS, or Windows.  See the [homebridge Wiki](https://github.com/nfarina/homebridge/wiki) for details.  I run homebridge-p1 on a Raspberry Pi 3 model B.  
I recommend using wired Ethernet to connect the server running homebridge and the AppleTV.

### Installation
The homebridge-p1 plugin obviously needs homebridge, which, in turn needs Node.js.  I've followed these steps to set it up:
- Install the latest v8 LTS version of Node.js.  On a Raspberry Pi, use the 8.x [Debian package](https://nodejs.org/en/download/package-manager/#debian-and-ubuntu-based-linux-distributions). On other platforms, download the [8.x.x LTS](https://nodejs.org) installer.  Both installations include the `npm` package manager;
- On macOS, make sure `/usr/local/bin` is in your `$PATH`, as `node`, `npm`, and, later, `homebridge` install there.  On a Raspberry Pi, these install to `/usr/bin`;
- You might want to update `npm` through `sudo npm -g update npm@latest`;
- Install homebridge through `sudo npm -g install homebridge --unsafe-perm`.  Follow the instructions on [GitHub](https://github.com/nfarina/homebridge#installation) to create a `config.json` in `~/.homebridge`, as described;
- Install the homebridge-p1 plugin through `sudo npm -g install homebridge-p1 --unsafe-perm`;
- Edit `~/.homebridge/config.json` and add the `P1` platform provided by homebridge-p1:
  ```json
  "platforms": [
    {
      "platform": "P1"
    }
  ]
  ```
