# Battery Service Registry

So far, we've defined our mock battery and wrapped it in Device wrapper so that it is ready to be included in a Service registry.

To do so meant committing to an embedded target build and a no-std environment compatible with the ODP crates and dependencies.

Now it is time to prepare the code we need to put this MockBatteryDevice to work.


### Looking at the examples
The `embedded-services` repository has some examples for us to consider already.  In the `embedded-services/examples/std` folder, particularly in `battery.rs` and `power_policy.rs` we can see how devices are created and then registered, and also how they are executed via per-device tasks.  The system is initialized and a runtime `Executor` is used to spawn the tasks.

There are a few tricks involved, though, because Embassy is normally designed to run in an embedded context, and we are using it in a std local machine environment.  That's fine.  In the end, we will build in such a way that we can define, build, and test our component completely before committing to an embedded target, and when we do there will only be minor changes required.


## 🔌 Wiring Up the Battery Service
We need to create a device `Registry` as defined by `embedded-services` to wire our `MockBatteryDevice` into.

To do this, let's replace our current `mock_battery/main.rs` with this:

```rust
mod time_driver;

use embassy_executor::Executor;
use static_cell::StaticCell;
use std::future::pending;


use embedded_services::init;
use embedded_services::power::policy::{register_device, DeviceId};

use mock_battery::mock_battery_device::MockBatteryDevice;

static EXECUTOR: StaticCell<Executor> = StaticCell::new();
static BATTERY: StaticCell<MockBatteryDevice> = StaticCell::new();

fn main() {
    let executor = EXECUTOR.init(Executor::new());
    executor.run(|spawner| {
        spawner.spawn(init_task()).unwrap();
        spawner.spawn(battery_service::task()).unwrap();
    });
}


#[embassy_executor::task]
async fn init_task() {
    println!("🔋 Launching battery service (single-threaded)");

    init().await;

    let battery_device = BATTERY.init(MockBatteryDevice::new(DeviceId(1)));

    println!("🧩 Registering battery device...");
    register_device(battery_device).await.unwrap();

    println!("✅ Battery service is up and running.");

    pending::<()>().await;
}
```

At the top of this file you see the line `mod time_driver;`  This is because we need to create a mock time driver for Embassy that
we can use in this environment.

Create a new file named `time_driver.rs` with this content:
```rust

use std::thread;
use std::time::Instant;

static START: once_cell::sync::Lazy<Instant> = once_cell::sync::Lazy::new(Instant::now);

#[unsafe(no_mangle)]
unsafe extern "C" fn _embassy_time_now() -> u64 {
    START.elapsed().as_micros() as u64
}

#[unsafe(no_mangle)]
unsafe extern "C" fn _embassy_time_schedule_wake(_timestamp: u64) {
    // No-op for std simulation
    thread::yield_now();
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

```rust
#[embassy_executor::task]
async fn battery_service_init_task(dev: &'static MockBatteryDevice) {
    println!("🔋 Initializing battery fuel gauge service...");
    let fuel_device = BATTERY_FUEL.init(BatteryDevice::new(BatteryDeviceId(dev.device().id().0)));
    battery_service::register_fuel_gauge(fuel_device).await.unwrap();
}
```
and we'll call upon it just after registering the device, so at the end of your `main` function, in the `executor.run(...)` block.
add 
```rust
        spawner.spawn(battery_service_init_task(battery_ref)).unwrap(); 
```
to join the other spawned tasks in this group.

Verify you can still build cleanly.  When you execute `cargo run` now, you should see output verifying our tasks have been run
```
     Running `target\debug\mock_battery.exe`
🔋 Initializing battery fuel gauge service...
🔋 Launching battery service (single-threaded)
🧩 Registering battery device...
✅ Battery service is up and running.

```

### Implementing "comms"

The battery service is one of several services that may reside within the Embedded Controller (EC) microcontroller. In a fully integrated system, messages between the EC and other components — such as a host CPU or companion chips — are typically carried over physical transports like SPI or I²C.

However, within the EC firmware itself, services communicate through an internal message routing layer known as comms. This abstraction allows us to test and exercise service logic without needing external hardware.

At this point, we’ll establish a simple comms setup that allows messages to reach our battery service from other parts of the EC — particularly the power policy manager. The overall comms architecture can expand later to handle actual buses, security paging, or multi-core domains, but for now, a minimal local implementation will suffice.

#### The "espi" comms
We'll follow a pattern exhibited by the ODP `embedded-services/examples/std/src/bin/battery.rs`, but trimmed for embedded/no-std use.

Create a file for a module named `espi_service.rs` inside your `mock_battery/src` folder and give it this content:

```rust
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

```rust
pub mod mock_battery;
pub mod mock_battery_device;
pub mod mock_battery_controller;
pub mod espi_service;
```

We also have to add the following line to the `[dependencies]` of our `mock_battery/Cargo.toml` file, since we are using `embassy-sync` here, and even though it is declared in our top-level toml, we need to bring it forward to this crate context.
```toml
embassy-sync = { workspace = true }
```

Now we will use this code in our `main.rs` file:

Add this `use` statement to import it:

```rust
use mock_battery::espi_service;
```

We need to call espi_service::init() asynchronously, so we need to create a task for this we can spawn in our main startup, so add this task:
```rust
#[embassy_executor::task]
async fn espi_init_task() {
    espi_service::init().await;
}
```
We can spawn the task for `espi_service::task()` after initialization.  So in your main `executor.run(...)` block, add these lines to the end of the other spawn instructions:
```rust
    // Start up our comms
    spawner.spawn(espi_init_task()).unwrap();
    spawner.spawn(espi_service::task()).unwrap();
 ```           











