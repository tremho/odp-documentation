# Using the ODP repositories for defined Battery Traits

In the previous section, we saw how the _Smart Battery Specification (SBS)_ defines a set of functions that a Smart Battery service should implement.

In this section, we are going to review how these traits are defined in Rust within the [embedded-services repository](https://github.com/OpenDevicePartnership/embedded-services/), and we are going to import these structures into our own workspace as we build our mock battery.

## Setting up for development
We are going to create a project space that contains a folder for our battery code, and the dependent repository clones.

So, start by finding a suitable location on your local computer and create the workpace:

```
mkdir battery_project
cd battery_project
mkdir mock_battery
```

Now, we are going to clone the embedded-batteries directory and build the crates it exports.

```
cd battery_project
git clone git@github.com:OpenDevicePartnership/embedded-batteries.git
cd embedded-batteries
cargo build
```

Now, we can go into our project space and start our own work.  Within the mock_battery directory, create this project structure:

```
src/ 
 - mock_battery.rs
Cargo.toml 
```
note that Cargo.toml is _not_ within the `src` folder, but `mock_battery.rs` is.

Use this as a minimal Cargo.toml to set things in place and declare our dependency on the embedded-batteries repository we cloned and built:
```
[package]
name = "mock_battery"
version = "0.1.0"
edition = "2021"

[dependencies]
embedded-batteries = { path = "../embedded-batteries/embedded-batteries" }  # Adjust as needed
```

# Implementing the defined traits
From the overview discussion you will recall that the SBS specification defines the Smart Battery with a series of functions that will return required data in expected ways.
Not surprisingly, then, we will find that the embedded-batteries crate we have imported defines these functions as traits to a SmartBattery trait.  If you new to Rust, recall that if this were, say, C++ or Java, we would call this the SmartBattery _class_, or an _interface_.  These are _almost_ interchangeable terms, but there are differences.  See [this definition](https://doc.rust-lang.org/book/ch10-02-traits.html) for more detail on that.

We will see the SmartBattery trait defines the same functions we saw in the specification (except for the optional proprietary manufacturer facilitations).

So our job now is to implement these functions with data that comes from our battery - our Mock Battery.

We'll start off our `mock_battery.rs` file with this:
```
use embedded_batteries::smart_battery::{
    SmartBattery, CapacityModeValue, CapacityModeSignedValue, BatteryModeFields,
    BatteryStatusFields, SpecificationInfoFields, ManufactureDate, ErrorType, 
    ErrorKind
};

#[derive(Debug)]
pub enum MockBatteryError {}

impl core::fmt::Display for MockBatteryError {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        write!(f, "MockBatteryError")
    }
}

use embedded_batteries::smart_battery::Error;

impl Error for MockBatteryError {
    fn kind(&self) -> ErrorKind {
        ErrorKind::Other
    }    
}


pub struct MockBattery;

impl ErrorType for MockBattery {
    type Error = MockBatteryError;
}

impl SmartBattery for MockBattery {
    fn remaining_capacity_alarm(&mut self) -> Result<CapacityModeValue, Self::Error> {
        Ok(CapacityModeValue::MilliAmpUnsigned(0))
    }

    fn set_remaining_capacity_alarm(&mut self, _val: CapacityModeValue) -> Result<(), Self::Error> {
        Ok(())
    }

    fn remaining_time_alarm(&mut self) -> Result<u16, Self::Error> {
        Ok(0)
    }

    fn set_remaining_time_alarm(&mut self, _val: u16) -> Result<(), Self::Error> {
        Ok(())
    }

    fn battery_mode(&mut self) -> Result<BatteryModeFields, Self::Error> {
        Ok(BatteryModeFields::default())
    }

    fn set_battery_mode(&mut self, _val: BatteryModeFields) -> Result<(), Self::Error> {
        Ok(())
    }

    fn at_rate(&mut self) -> Result<CapacityModeSignedValue, Self::Error> {
        Ok(CapacityModeSignedValue::MilliAmpSigned(0))
    }

    fn set_at_rate(&mut self, _val: CapacityModeSignedValue) -> Result<(), Self::Error> {
        Ok(())
    }

    fn at_rate_time_to_full(&mut self) -> Result<u16, Self::Error> {
        Ok(0)
    }

    fn at_rate_time_to_empty(&mut self) -> Result<u16, Self::Error> {
        Ok(0)
    }

    fn at_rate_ok(&mut self) -> Result<bool, Self::Error> {
        Ok(true)
    }

    fn temperature(&mut self) -> Result<u16, Self::Error> {
        Ok(2950) // 29.5°C in deciKelvin
    }

    fn voltage(&mut self) -> Result<u16, Self::Error> {
        Ok(7500) // mV
    }

    fn current(&mut self) -> Result<i16, Self::Error> {
        Ok(1500)
    }

    fn average_current(&mut self) -> Result<i16, Self::Error> {
        Ok(1400)
    }

    fn max_error(&mut self) -> Result<u8, Self::Error> {
        Ok(1)
    }

    fn relative_state_of_charge(&mut self) -> Result<u8, Self::Error> {
        Ok(88)
    }

    fn absolute_state_of_charge(&mut self) -> Result<u8, Self::Error> {
        Ok(85)
    }

    fn remaining_capacity(&mut self) -> Result<CapacityModeValue, Self::Error> {
        Ok(CapacityModeValue::MilliAmpUnsigned(4200))
    }

    fn full_charge_capacity(&mut self) -> Result<CapacityModeValue, Self::Error> {
        Ok(CapacityModeValue::MilliAmpUnsigned(4800))
    }

    fn run_time_to_empty(&mut self) -> Result<u16, Self::Error> {
        Ok(60)
    }

    fn average_time_to_empty(&mut self) -> Result<u16, Self::Error> {
        Ok(75)
    }

    fn average_time_to_full(&mut self) -> Result<u16, Self::Error> {
        Ok(30)
    }

    fn charging_current(&mut self) -> Result<u16, Self::Error> {
        Ok(2000)
    }

    fn charging_voltage(&mut self) -> Result<u16, Self::Error> {
        Ok(8400)
    }

    fn battery_status(&mut self) -> Result<BatteryStatusFields, Self::Error> {
        Ok(BatteryStatusFields::default())
    }

    fn cycle_count(&mut self) -> Result<u16, Self::Error> {
        Ok(100)
    }

    fn design_capacity(&mut self) -> Result<CapacityModeValue, Self::Error> {
        Ok(CapacityModeValue::MilliAmpUnsigned(5000))
    }

    fn design_voltage(&mut self) -> Result<u16, Self::Error> {
        Ok(7800)
    }

    fn specification_info(&mut self) -> Result<SpecificationInfoFields, Self::Error> {
        Ok(SpecificationInfoFields::default())
    }

    fn manufacture_date(&mut self) -> Result<ManufactureDate, Self::Error> {
        let mut date = ManufactureDate::new();
        date.set_day(1);
        date.set_month(1);
        date.set_year(2025 - 1980); // must use offset from 1980

        Ok(date)
    }

    fn serial_number(&mut self) -> Result<u16, Self::Error> {
        Ok(12345)
    }

    fn manufacturer_name(&mut self, buf: &mut [u8]) -> Result<(), Self::Error> {
        let name = b"MockBatteryCorp";
        buf[..name.len()].copy_from_slice(name);
        Ok(())
    }

    fn device_name(&mut self, buf: &mut [u8]) -> Result<(), Self::Error> {
        let name = b"MB-4200";
        buf[..name.len()].copy_from_slice(name);
        Ok(())
    }

    fn device_chemistry(&mut self, buf: &mut [u8]) -> Result<(), Self::Error> {
        let name = b"Li-Ion";
        buf[..name.len()].copy_from_slice(name);
        Ok(())
    }
}

```
We'll unpack what all this is in a moment.  For now, let's verify this Rust code is valid and that we've imported from the ODP repository properly.

Type
```
cargo build
```
at the project root.  This should build without error.

## Now to expose this to the service

We have defined the battery traits and given our simulated placeholder values for our mock battery here.
If we were implementing a real battery, the process would follow the same pattern except that instead of the literal values we've assigned, we would
call upon our Hardware Abstraction Layer (HAL) implementation modules to pull these values from the actual hardware circuitry, per manufacturer design (i.e. GPIO or MMIO).
But before any of this is useful, it needs to be exposed to the service layer.  In the next step, we'll do a simple test that shows we can expose these values, and then we'll implement the service layer that conveys these up the chain in response to service messages.


