# Battery Service Registry

So far, we've defined our mock battery and wrapped it in Device wrapper so that it is ready to be included in a Service registry.

To do so meant committing to an embedded target build and a no-std environment compatible with the ODP crates and dependencies.

Now it is time to prepare the code we need to put this MockBatteryDevice to work.

### Another import for our std environment
The async model used in embassy is not available in our std environment,
so we need to make some adjustments to account for that until we get to the 
point of actually building for embedded.

Perhaps the most seamless option is to use the crate `tokio` for this solution.

To prepare for this, add the following to the `[dependencies]` section of `mock_battery/Cargo.toml`:
```toml
tokio = { version = "1", features = ["rt", "macros", "sync"] }
```

### Looking at the examples
The `embedded-services` repository has some examples for us to consider already.  In the `embedded-services/examples/std` folder, particularly in `battery.rs` and `power_policy.rs` we can see how devices are created and then registered, and also how they are executed via per-device tasks.  The system is initialized and a runtime `Executor` is used to spawn the tasks.


## 🔌 Wiring Up the Battery Service
We need to create a device `Registry` as defined by `embedded-services` to wire our `MockBatteryDevice` into.

To do this, let's replace our current `mock_battery/main.rs` with this:

```rust
use mock_battery::mock_battery_device::MockBatteryDevice;
use embedded_services::init;
use embedded_services::power::policy::{register_device, DeviceId};

use static_cell::StaticCell;
use tokio::task::LocalSet;

static BATTERY: StaticCell<MockBatteryDevice> = StaticCell::new();

#[tokio::main(flavor = "current_thread")]
async fn main() {
    println!("🔋 Launching battery service (single-threaded)");

    let local = LocalSet::new();

    local.run_until(async {
        init().await;

        let battery_device = BATTERY.init(MockBatteryDevice::new(DeviceId(1)));

        println!("🧩 Registering battery device...");
        let _ = register_device(battery_device).await;

        println!("▶️ Spawning battery runtime loop...");
        tokio::task::spawn_local(battery_device.run());

        println!("✅ Battery service is up and running.");

        // Wait forever
        std::future::pending::<()>().await;
    }).await;
}
```
With everything in place, you should type `cargo run` and after it builds you should see this output:

```
      Running `target\debug\mock_battery.exe`
🔋 Launching battery service (single-threaded)
🧩 Registering battery device...
▶️ Spawning battery runtime loop...
✅ Battery service is up and running.
```

_TODO: This is where we left off_ 

## The Battery Service
Now we have registered our battery device as a device for the embedded-services power policy,
but the `battery_service` knows how to use a battery specifically, so we need to register our battery as a 'fuel gauge' by that definition.

### The Battery Controller
The battery service `Controller` is the trait interface used to control a battery connected via the SmartBattery trait interface at a slightly higher level.  

Create a new file in `mock_battery` named `mock_battery_controller.rs` and give it this content:
```rust
use battery_service::controller::{Controller, ControllerEvent};
use battery_service::device::{DynamicBatteryMsgs, StaticBatteryMsgs};
use embassy_time::{Duration, Timer};
use embedded_batteries_async::smart_battery::{
    SmartBattery, ErrorType, 
    ManufactureDate, SpecificationInfoFields, CapacityModeValue, CapacityModeSignedValue,
    BatteryModeFields, BatteryStatusFields, 
    DeciKelvin, MilliVolts
};
use core::convert::Infallible;

pub struct MockBatteryController;

impl MockBatteryController {
    pub fn new() -> Self {
        Self
    }
}

impl ErrorType for MockBatteryController {
    type Error = Infallible;
}

impl SmartBattery for &mut MockBatteryController {
    async fn temperature(&mut self) -> Result<DeciKelvin, Self::Error> {
        Ok(2732) // Stubbed temperature in deci-Kelvin
    }
    // You can stub other SmartBattery methods as needed
    async fn voltage(&mut self) -> Result<MilliVolts, Self::Error> {
        Ok(11000)
    }


    // Stub all other required methods
    async fn remaining_capacity_alarm(&mut self) -> Result<CapacityModeValue, Self::Error> {
        Ok(CapacityModeValue::MilliAmpUnsigned(0))
    }

    async fn set_remaining_capacity_alarm(&mut self, _: CapacityModeValue) -> Result<(), Self::Error> {
        Ok(())
    }

    async fn remaining_time_alarm(&mut self) -> Result<u16, Self::Error> {
        Ok(0)
    }

    async fn set_remaining_time_alarm(&mut self, _: u16) -> Result<(), Self::Error> {
        Ok(())
    }

    async fn battery_mode(&mut self) -> Result<BatteryModeFields, Self::Error> {
        Ok(BatteryModeFields::new())
    }

    async fn set_battery_mode(&mut self, _: BatteryModeFields) -> Result<(), Self::Error> {
        Ok(())
    }

    async fn at_rate(&mut self) -> Result<CapacityModeSignedValue, Self::Error> {
        Ok(CapacityModeSignedValue::MilliAmpSigned(0))
    }

    async fn set_at_rate(&mut self, _: CapacityModeSignedValue) -> Result<(), Self::Error> {
        Ok(())
    }

    async fn at_rate_time_to_full(&mut self) -> Result<u16, Self::Error> {
        Ok(0)
    }

    async fn at_rate_time_to_empty(&mut self) -> Result<u16, Self::Error> {
        Ok(0)
    }

    async fn at_rate_ok(&mut self) -> Result<bool, Self::Error> {
        Ok(true)
    }

    async fn current(&mut self) -> Result<i16, Self::Error> {
        Ok(0)
    }

    async fn average_current(&mut self) -> Result<i16, Self::Error> {
        Ok(0)
    }

    async fn max_error(&mut self) -> Result<u8, Self::Error> {
        Ok(0)
    }

    async fn relative_state_of_charge(&mut self) -> Result<u8, Self::Error> {
        Ok(0)
    }

    async fn absolute_state_of_charge(&mut self) -> Result<u8, Self::Error> {
        Ok(0)
    }

    async fn remaining_capacity(&mut self) -> Result<CapacityModeValue, Self::Error> {
        Ok(CapacityModeValue::MilliAmpUnsigned(0))
    }

    async fn full_charge_capacity(&mut self) -> Result<CapacityModeValue, Self::Error> {
        Ok(CapacityModeValue::MilliAmpUnsigned(0))
    }

    async fn run_time_to_empty(&mut self) -> Result<u16, Self::Error> {
        Ok(0)
    }

    async fn average_time_to_empty(&mut self) -> Result<u16, Self::Error> {
        Ok(0)
    }

    async fn average_time_to_full(&mut self) -> Result<u16, Self::Error> {
        Ok(0)
    }

    async fn charging_current(&mut self) -> Result<u16, Self::Error> {
        Ok(0)
    }

    async fn charging_voltage(&mut self) -> Result<u16, Self::Error> {
        Ok(0)
    }

    async fn battery_status(&mut self) -> Result<BatteryStatusFields, Self::Error> {
        Ok(BatteryStatusFields::new())
    }

    async fn cycle_count(&mut self) -> Result<u16, Self::Error> {
        Ok(0)
    }

    async fn design_capacity(&mut self) -> Result<CapacityModeValue, Self::Error> {
        Ok(CapacityModeValue::MilliAmpUnsigned(0))
    }

    async fn design_voltage(&mut self) -> Result<u16, Self::Error> {
        Ok(0)
    }

    async fn specification_info(&mut self) -> Result<SpecificationInfoFields, Self::Error> {
        Ok(SpecificationInfoFields::new())
    }

    async fn manufacture_date(&mut self) -> Result<ManufactureDate, Self::Error> {
        let mut date = ManufactureDate::new();
        date.set_day(1);
        date.set_month(1);
        date.set_year(2025 - 1980); // must use offset from 1980

        Ok(date)
    }

    async fn serial_number(&mut self) -> Result<u16, Self::Error> {
        Ok(0)
    }

    async fn manufacturer_name(&mut self, _: &mut [u8]) -> Result<(), Self::Error> {
        Ok(())
    }

    async fn device_name(&mut self, _: &mut [u8]) -> Result<(), Self::Error> {
        Ok(())
    }

    async fn device_chemistry(&mut self, _: &mut [u8]) -> Result<(), Self::Error> {
        Ok(())
    }    
}

impl Controller for &mut MockBatteryController {
    type ControllerError = Infallible;

    async fn initialize(&mut self) -> Result<(), Self::ControllerError> {
        Ok(())
    }

    async fn get_static_data(&mut self) -> Result<StaticBatteryMsgs, Self::ControllerError> {
        Ok(StaticBatteryMsgs { ..Default::default() })
    }

    async fn get_dynamic_data(&mut self) -> Result<DynamicBatteryMsgs, Self::ControllerError> {
        Ok(DynamicBatteryMsgs { ..Default::default() })
    }

    async fn get_device_event(&mut self) -> ControllerEvent {
        loop {
            Timer::after(Duration::from_secs(60)).await;
        }
    }

    async fn ping(&mut self) -> Result<(), Self::ControllerError> {
        Ok(())
    }

    fn get_timeout(&self) -> Duration {
        Duration::from_secs(10)
    }

    fn set_timeout(&mut self, _duration: Duration) {
        // Ignored for mock
    }
}
```
This just implements the SmartBattery traits with stubs for now.  We will connect it to our mock_battery shortly.  But for now, this gets us going past the next few steps.

#### add to `lib.rs`
Don't forget that we need to include this new file in our `lib.rs` declarations:

```rust
pub mod mock_battery;
pub mod mock_battery_device;
pub mod mock_battery_controller;
```

Make sure you can build cleanly at this point, and then we will move ahead.

### The fuel gauge
The battery service has the concept of a 'fuel gauge' that calls into the SmartBattery traits to monitor charge / discharge. 

We'll hook that up now.

Add this task to your `main.rs` file, nearby the other tasks found there:

```
#[embassy_executor::task]
async fn battery_service_init_task(dev: &'static Device) {
    let reg = battery_service::register_fuel_gauge(dev).await;
    if reg.is_err() {
        // Handle registration failure as needed
        panic!("Failed to register fuel gauge device");
    }
}

```
and we'll call upon it just after registering the device, so at the end of your `async main` function, just after `spawner.must_spawn(wrapper_task(wrapper));`, add this:
```
 
    // Register the fuel gauge device with the battery service
    spawner.must_spawn(battery_service_init_task(dev));
```

Verify you can still build cleanly
```
cargo build --target thumbv7em-none-eabihf
```

### Implementing "comms"

The battery service is one of several services that may reside within the Embedded Controller (EC) microcontroller. In a fully integrated system, messages between the EC and other components — such as a host CPU or companion chips — are typically carried over physical transports like SPI or I²C.

However, within the EC firmware itself, services communicate through an internal message routing layer known as comms. This abstraction allows us to test and exercise service logic without needing external hardware.

At this point, we’ll establish a simple comms setup that allows messages to reach our battery service from other parts of the EC — particularly the power policy manager. The overall comms architecture can expand later to handle actual buses, security paging, or multi-core domains, but for now, a minimal local implementation will suffice.

#### The "espi" comms
We'll follow a pattern exhibited by the ODP `embedded-services/examples/std/src/bin/battery.rs`, but trimmed for embedded/no-std use.

Create a file for a module named `espi_service.rs` inside your `mock_battery/src` folder and give it this content:

```
use battery_service::context::{BatteryEvent, BatteryEventInner};
use battery_service::device::DeviceId;
use embassy_sync::blocking_mutex::raw::NoopRawMutex;
use embassy_sync::once_lock::OnceLock;
use embassy_sync::signal::Signal;
use embedded_services::comms::{self, EndpointID, External};
use embedded_services::ec_type::message::BatteryMessage;


pub struct EspiService {
    endpoint: comms::Endpoint,
    _signal: Signal<NoopRawMutex, BatteryMessage>,
}

impl EspiService {
    pub fn new() -> Self {
        Self {
            endpoint: comms::Endpoint::uninit(EndpointID::External(External::Host)),
            _signal: Signal::new(),
        }
    }
}

impl comms::MailboxDelegate for EspiService {
    fn receive(&self, message: &comms::Message) -> Result<(), comms::MailboxDelegateError> {
        let msg = message
            .data
            .get::<BatteryMessage>()
            .ok_or(comms::MailboxDelegateError::MessageNotFound)?;

        match msg {
            BatteryMessage::CycleCount(_count) => {
                // Do something if needed; placeholder
                Ok(())
            }
            _ => Err(comms::MailboxDelegateError::InvalidData),
        }
    }
}

static ESPI_SERVICE: OnceLock<EspiService> = OnceLock::new();

pub async fn init() {

    let svc = ESPI_SERVICE.get_or_init(EspiService::new);
    if comms::register_endpoint(svc, &svc.endpoint).await.is_err() {
        // Handle registration failure as needed
        panic!("Failed to register ESPI service endpoint");
    }

}

#[embassy_executor::task]
pub async fn task() {
    let svc = ESPI_SERVICE.get().await;

    let _ = svc.endpoint.send(
        EndpointID::Internal(comms::Internal::Battery),
        &BatteryEvent {
            device_id: DeviceId(1),
            event: BatteryEventInner::DoInit,
        },
    ).await;

    let _ = battery_service::wait_for_battery_response().await;

    loop {
        let _ = svc.endpoint.send(
            EndpointID::Internal(comms::Internal::Battery),
            &BatteryEvent {
                device_id: DeviceId(1),
                event: BatteryEventInner::PollDynamicData,
            },
        ).await;

        let _ = battery_service::wait_for_battery_response().await;

        embassy_time::Timer::after(embassy_time::Duration::from_secs(5)).await;
    }
}
```
Before the loop, the DoInit message is sent which will cause `Controller::initialize` to be invoked via service layer.  The loop runs at 5 second intervals and polls for updates in the dynamic data
(such as the current level of charge).

and, by now I'm sure you know the drill, remember to add this module to your `lib.rs` file:

```
#![no_std]
pub mod mock_battery;
pub mod mock_battery_device;
pub mod mock_battery_controller;
pub mod espi_service;
```

Now we will attach it in our `main.rs` file.

Add this `use` statement to import it:

```
use mock_battery::espi_service;
```
and these lines at the end of your `async main` to initialize it and spin it up:
```
    // Start up our comms
    espi_service::init().await;
    spawner.must_spawn(espi_service::task());
 ```           

### Adding some logging support
We are now in a position to get data from our battery.  But how will we know? We need some logging in place first.  Let's hook that up now.

In your `mock_battery/Cargo.toml`, add or update these values in their respective sections:
```
[dependencies]
defmt = "1.0"
defmt-rtt = "0.4"
panic-probe = { version = "0.3", features = ["print-defmt"] }

# Add the log shim for libraries using `log` crate
log = { version = "0.4", features = ["release_max_level_debug"], optional = true }
defmt-log = { version = "0.3", optional = true }

[features]
default = ["embedded", "defmt-log", "log"]

[package.metadata.cargo-xbuild]
linker = "rust-lld"

```
We can now remove the `#![panic_handler] block in `main.rs` altogether and replace it with:

```
/// Required by embedded targets for panic handling
use panic_probe as _; // This provides a defmt-compatible panic handler
```
The panic-probe crate, when built with the print-defmt feature, automatically installs the right panic handler for you — no need to write one manually.

Using the logging is straightforward.  Examples of log statements would be like:

```
info!("Starting wrapper task");
warn!("Something unusual");
error!("Something failed: {:?}", err);
```
<!-- 
Note - this setup for logging is incomplete and turns out to be much more of a rabbit-hole than I could have imagined.
Additionally, major revisions to memory.x and
some of the cargo settings are needed, plus some
stubs for the cortex-m that need to be put into place that are not documented yet before anything
will build correctly to flash to the hardware. 
This is the current WIP and may require a separate section before continuing here.
-->
### Getting the dynamic data
So now that we have logging in place,











