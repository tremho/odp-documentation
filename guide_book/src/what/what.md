# What is in ODP?

There are over 60 repositories that make up the whole of the ODP umbrella. Many of these are simply HAL definitions for particular hardware, but others define the critical business logic and data traits that comprise the portable and modular framework ODP provides. Many of the crates defined by these repositories may be interdependent.  
Other repositories represented here define tools and tests that are useful in development.

---

## Patina

| Repository | Description | Tags |
|------------|-------------|------|
| [Developing UEFI with Rust](https://sturdy-adventure-nv32gqw.pages.github.io/) | _(Document)_ Overview of ODP Patina and Rust, contribution guide, and build setup. | Patina · Other |
| [patina](https://github.com/OpenDevicePartnership/patina) | Library of crates implementing Patina UEFI code. | Patina |
| [patina-dxe-core-qemu](https://github.com/OpenDevicePartnership/patina-dxe-core-qemu) | Builds `.efi` image from Patina libraries and local components for QEMU. | Patina |
| [patina-qemu](https://github.com/OpenDevicePartnership/patina-qemu) | QEMU platform firmware integrating `.efi` Patina binaries. | Patina |
| [patina-fw-patcher](https://github.com/OpenDevicePartnership/patina-fw-patcher) | Speeds up incremental firmware build iterations vs. full `stuart_build`. | Patina · Tooling |
| [patina-mtrr](https://github.com/OpenDevicePartnership/patina-mtrr) | MTRR (Memory Type Range Register) library for x86_64. | Patina |
| [patina-paging](https://github.com/OpenDevicePartnership/patina-paging) | Common paging support for ARM64 and x64. | Patina |
| [ffa](https://github.com/OpenDevicePartnership/ffa) | FF-A services in Rust for Hafnium. | EC · Patina |
| [haf-ec-service](https://github.com/OpenDevicePartnership/haf-ec-service) | Rust EC services for Hafnium. | EC · Patina |
| [uefi-bds](https://github.com/OpenDevicePartnership/uefi-bds) | UEFI Boot Device Selection DXE driver. | Patina · Other |
| [uefi-corosensei](https://github.com/OpenDevicePartnership/uefi-corosensei) | UEFI fork of corosensei crate. | Patina · Other |
| [modern-payload](https://github.com/OpenDevicePartnership/modern-payload) | Slimmed down UEFI payload. | Patina · Other |
| [slimloader](https://github.com/OpenDevicePartnership/slimloader) | First stage boot loader for AArch64. | Patina · Other |
| [ec-slimloader](https://github.com/OpenDevicePartnership/ec-slimloader) | Stage-one EC bootloader. | Patina · EC · Other |
| [ec-slimloader-descriptors](https://github.com/OpenDevicePartnership/ec-slimloader-descriptors) | Boot descriptors for multi-image firmware scenarios. | Patina · EC · Other |

---

## EC

| Repository | Description | Tags |
|------------|-------------|------|
| [embedded_services](https://github.com/OpenDevicePartnership/embedded-services) | Service definitions wrapping HAL components. | EC |
| [soc-embedded-controller](https://github.com/OpenDevicePartnership/soc-embedded-controller) | Demonstration of EC firmware built using ODP components. | EC |
| [embedded-batteries](https://github.com/OpenDevicePartnership/embedded-batteries) | SmartBattery spec traits for HAL abstraction. | EC |
| [embedded-sensors](https://github.com/OpenDevicePartnership/embedded-sensors) | Embedded sensors HAL abstraction. | EC |
| [embedded-fans](https://github.com/OpenDevicePartnership/embedded-fans) | HAL definition for fan control. | EC |
| [embedded-power-sequence](https://github.com/OpenDevicePartnership/embedded-power-sequence) | SoC power on/off abstraction. | EC |
| [embedded-cfu](https://github.com/OpenDevicePartnership/embedded-cfu) | Implements Windows CFU commands/responses. | EC |
| [embedded-usb-pd](https://github.com/OpenDevicePartnership/embedded-usb-pd) | Common types for USB-PD. | EC |
| [embedded-mcu](https://github.com/OpenDevicePartnership/embedded-mcu) | MCU traits and libraries for hardware peripherals. | EC |
| [hid-embedded-controller](https://github.com/OpenDevicePartnership/hid-embedded-controller) | HID over I2C demo library for ECs. | EC |
| [ec-test-app](https://github.com/OpenDevicePartnership/ec-test-app) | Test application to exercise EC functionality via ACPI. | EC · Tooling |
| [bq24773](https://github.com/OpenDevicePartnership/bq24773) | TI BQ24773 battery charger driver. | EC · Other |
| [bq25713](https://github.com/OpenDevicePartnership/bq25713) | TI BQ25713 battery charger driver. | EC · Other |
| [bq25730](https://github.com/OpenDevicePartnership/bq25730) | TI BQ25730 battery charger driver. | EC · Other |
| [bq25770g](https://github.com/OpenDevicePartnership/bq25770g) | TI BQ2577G battery charger driver. | EC · Other |
| [bq25773](https://github.com/OpenDevicePartnership/bq25773) | TI BQ25773 battery charger driver. | EC · Other |
| [bq40z50](https://github.com/OpenDevicePartnership/bq40z50) | TI BQ40Z50 Li-ion pack manager driver. | EC · Other |
| [tmp108](https://github.com/OpenDevicePartnership/tmp108) | TI TMP108 temperature sensor driver. | EC · Other |
| [cec17-data](https://github.com/OpenDevicePartnership/cec17-data) | Meta-PAC for Microchip MEC/CEC MCUs. | EC · Other |
| [mec17xx-pac](https://github.com/OpenDevicePartnership/mec17xx-pac) | PAC for Microchip MEC17xx family. | EC · Other |
| [mimxrt633s-pac](https://github.com/OpenDevicePartnership/mimxrt633s-pac) | PAC for NXP RT633s MCU. | EC · Other |
| [mimxrt685s-pac](https://github.com/OpenDevicePartnership/mimxrt685s-pac) | PAC for NXP MIMXRT685s MCU. | EC · Other |
| [mimxrt685s-examples](https://github.com/OpenDevicePartnership/mimxrt685s-examples) | Examples using `mimxrt685s-pac`. | EC · Other |
| [npcx490m-pac](https://github.com/OpenDevicePartnership/npcx490m-pac) | PAC for Nuvoton NPCX490M MCU. | EC · Other |
| [npcx490m-examples](https://github.com/OpenDevicePartnership/npcx490m-examples) | Examples using `npcx490m-pac`. | EC · Other |
| [embedded-regulator](https://github.com/OpenDevicePartnership/embedded-regulator) | HAL for system voltage regulators. | EC · Other |
| [embedded-keyboard-rs](https://github.com/OpenDevicePartnership/embedded-keyboard-rs) | Driver for matrix keyboards. | EC · Other |
| [rt4531](https://github.com/OpenDevicePartnership/rt4531) | Richtek RT4531 keyboard backlight controller driver. | EC · Other |
| [tps65994ae](https://github.com/OpenDevicePartnership/tps65994ae) | TI TPS65994AE USB-C PD controller driver. | EC · Other |
| [tps6699x](https://github.com/OpenDevicePartnership/tps6699x) | TI TPS6699x USB-C PD controller driver. | EC · Other |
| [is31fl3743b](https://github.com/OpenDevicePartnership/is31fl3743b) | Lumissil IS31FL3743B LED matrix controller driver. | EC · Other |
| [pcal6416a](https://github.com/OpenDevicePartnership/pcal6416a) | IO Expander driver. | EC · Other |
| [embassy-imxrt](https://github.com/OpenDevicePartnership/embassy-imxrt) | Embassy HAL for NXP IMXRT family. | EC · Other |
| [embassy-microchip](https://github.com/OpenDevicePartnership/embassy-microchip) | Embassy HAL for Microchip MEC17xx/MEC16xx. | EC · Other |
| [embassy-npcx](https://github.com/OpenDevicePartnership/embassy-npcx) | Embassy HAL for Nuvoton NPCX family. | EC · Other |
| [lis2dw12-i2c](https://github.com/OpenDevicePartnership/lis2dw12-i2c) | ST LIS2DW12 accelerometer driver. | EC · Other |
| [mimxrt600-fcb](https://github.com/OpenDevicePartnership/mimxrt600-fcb) | Flash Control Block for MIMXRT600 MCUs. | EC · Other |
| [MX25U1632FZUI02](https://github.com/OpenDevicePartnership/MX25U1632FZUI02) | Macronix MX25U1632FZUI02 flash part driver. | EC · Other |

---

## Security

| Repository | Description | Tags |
|------------|-------------|------|
| [rust_crate_audits](https://github.com/OpenDevicePartnership/rust-crate-audits) | Aggregated Rust crate audits. | Security · Other |

---

## Tooling

| Repository | Description | Tags |
|------------|-------------|------|
| [patina-fw-patcher](https://github.com/OpenDevicePartnership/patina-fw-patcher) | Incremental build helper for Patina firmware. | Patina · Tooling |
| [ec-test-app](https://github.com/OpenDevicePartnership/ec-test-app) | ACPI test application for EC functionality. | EC · Tooling |
| [odp-utilites](https://github.com/OpenDevicePartnership/odp-utilites) | Rust utilities for embedded development. | Tooling · Other |
| [systemview-tracing](https://github.com/OpenDevicePartnership/systemview-tracing) | Adds Segger SystemView tracing to ODP. | Tooling · Other |
| [nxp-header](https://github.com/OpenDevicePartnership/nxp-header) | CLI utility for NXP image headers. | Tooling · Other |

---

## Other

| Repository | Description | Tags |
|------------|-------------|------|
| [Developing UEFI with Rust](https://sturdy-adventure-nv32gqw.pages.github.io/) | _(Document)_ Overview of ODP Patina and Rust. | Patina · Other |
| [rust_crate_audits](https://github.com/OpenDevicePartnership/rust-crate-audits) | Aggregated Rust crate audits. | Security · Other |
| [uefi-bds](https://github.com/OpenDevicePartnership/uefi-bds) | UEFI Boot Device Selection DXE driver. | Patina · Other |
| [uefi-corosensei](https://github.com/OpenDevicePartnership/uefi-corosensei) | UEFI fork of corosensei crate. | Patina · Other |
| [modern-payload](https://github.com/OpenDevicePartnership/modern-payload) | Slimmed down UEFI payload. | Patina · Other |
| [slimloader](https://github.com/OpenDevicePartnership/slimloader) | First stage boot loader for AArch64. | Patina · Other |
| [ec-slimloader](https://github.com/OpenDevicePartnership/ec-slimloader) | Stage-one EC bootloader. | Patina · EC · Other |
| [ec-slimloader-descriptors](https://github.com/OpenDevicePartnership/ec-slimloader-descriptors) | Boot descriptors for multi-image firmware scenarios. | Patina · EC · Other |
| [odp-utilites](https://github.com/OpenDevicePartnership/odp-utilites) | Rust utilities for embedded development. | Tooling · Other |
| [systemview-tracing](https://github.com/OpenDevicePartnership/systemview-tracing) | Adds Segger SystemView tracing to ODP. | Tooling · Other |
| [nxp-header](https://github.com/OpenDevicePartnership/nxp-header) | CLI utility for NXP image headers. | Tooling · Other |
