# Testing the Battery in integration

First, we'll test aspects of the battery.  We already have unit tests for the battery, but we want to make sure
the battery is behaving properly when it is integrated into a subsystem.

## Separating the tests by group
As we write our integration tests, we could just put all our tasks into `entry.rs` regardless of what we are testing, especially
since we're starting out with the common allocations.

But it would be better from a code management standpoint if we were to separate our tests into separate files grouping similar tests.   In that spirit, let's create a new file named `battery_tests.rs` that we will put our battery-oriented tests into.

Add this as the content to get us started.  This will define the tasks that register our battery device, and the "fuel gauge service" that attaches to the battery device, as well as the `comms` services (our `EspiService`):
```rust
use mock_battery::mock_battery_device::MockBatteryDevice;
use embedded_services::init;
use embedded_services::power::policy::register_device;
use crate::entry::{BatteryChannelWrapper, ChargerChannelWrapper};
use battery_service::device::Device as BatteryDevice;
use ec_common::espi_service::EspiService;
use ec_common::fuel_signal_ready::BatteryFuelReadySignal;
use ec_common::mutex::{Mutex,RawMutex};
use crate::test_observer::{Observation, ObservationResult};

#[embassy_executor::task]
pub async fn init_task(battery:&'static mut MockBatteryDevice) {
    println!("🔋 Launching battery service (single-threaded)");

    init().await;

    println!("🧩 Registering battery device...");
    register_device(battery).await.unwrap();

    println!("✅🔋 Battery service is up and running.");
}
#[embassy_executor::task]
pub async fn battery_service_init_task(
    dev: &'static mut BatteryDevice,
    ready: &'static BatteryFuelReadySignal // passed in signal
) {
    println!("🔌 Initializing battery fuel gauge service...");
    battery_service::register_fuel_gauge(dev).await.unwrap();
    
    // signal that the battery fuel service is ready
    ready.signal(); 
}
#[embassy_executor::task]
pub async fn espi_service_init_task(
    observer: &'static Mutex<RawMutex, Observation>,
    espi_svc: &'static mut EspiService<'static, BatteryChannelWrapper, ChargerChannelWrapper>,
) {
    embedded_services::comms::register_endpoint(espi_svc, &espi_svc.endpoint)
    .await
    .expect("Failed to register espi_service");
    let mut obs = observer.lock().await;
    obs.mark(ObservationResult::Pass);
}
```
and then in `main.rs` add this to include it into the build sources:
```rust
mod battery_tests;
```
Now, in `entry.rs` we can import our new tasks:
```rust
use crate::battery_tests::{
    init_task,
    espi_service_init_task
}
```

We need to create the EventChannel for Charger messages because we haven't done that yet.
Add near the other static allocations:
```rust
static CHARGER_EVENT_CHANNEL: StaticCell<ChargerChannelWrapper> = StaticCell::new();
```
and assign its init value below:
```rust
    let charger_channel = CHARGER_EVENT_CHANNEL.init(ChargerChannelWrapper(Channel::new()));
```
We also need to create our references to ESPI_SERVICE:
```
    let espi_svc = ESPI_SERVICE.init(EspiService::new(battery_channel, charger_channel));
    let espi_svc_init = duplicate_static_mut!(espi_svc, EspiService<'static, BatteryChannelWrapper, ChargerChannelWrapper>);
```
Then we can replace the current spawn set with:
```rust
    spawner.spawn(init_task(battery_device)).unwrap();
    spawner.spawn(espi_service_init_task(obs_espi, espi_svc_init)).unwrap();
    spawner.spawn(observations_complete_task()).unwrap();
```

We also want to create an `Observation` for our `espi_service_init_task` to report success on.

Include the following import:
```rust


Remove our "Example Pass" observer.  We won't be needing it now that we are writing real tests.
Replace
```rust
    let obs_pass = observation_decl!(OBS_PASS, "Example Pass");
```
with
```rust
    let obs_espi = observation_decl!(OBS_ESPI_INIT, "ESPI service init completed");
```

### Checking our first battery test version

You should be able to issue a `cargo run` command here and see:
```
     Running `C:\Users\StevenOhmert\odp\ec_examples\target\debug\battery_charger_subsystem.exe`
🚀 Starting battery + charger integration test
🔋 Launching battery service (single-threaded)
🧩 Registering battery device...
✅🔋 Battery service is up and running.
✅ ESPI service init completed: Passed

Summary: ✅ 1 passed, ❌ 0 failed, ❓ 0 unseen
```
We have reports from the println! output seen, but only the one actual `Observation`, for the "Espi service init completed".  

Let's add some more tasks to further support the runtime environment and provide observers to check when:
- Fuel Service signals it is ready
- We confirm receipt of a message sent to provide static data
- We confirm receipt of a message sent to provide dynamic data

Let's start with the additional tasks:
```rust
#[embassy_executor::task]
pub async fn wrapper_task(wrapper: &'static mut Wrapper<'static, &'static mut BatteryController>) {
    wrapper.process().await;
}
#[embassy_executor::task]
pub async fn test_message_sender(
    svc: &'static mut EspiService<'static, BatteryChannelWrapper, ChargerChannelWrapper>,    
) {

    use battery_service::context::{BatteryEvent, BatteryEventInner};
    use battery_service::device::DeviceId;
    use embedded_services::comms::EndpointID;

    println!("✍ Sending test BatteryEvent...");

    // Wait a moment to ensure other services are initialized 
    embassy_time::Timer::after(embassy_time::Duration::from_millis(100)).await;

    let event = BatteryEvent {
        device_id: DeviceId(1),
        event: BatteryEventInner::PollStaticData, // or DoInit, PollDynamicData, etc.
    };

    if let Err(e) = svc.endpoint.send(
        EndpointID::Internal(embedded_services::comms::Internal::Battery),
        &event,
    ).await {
        println!("❌ Failed to send test BatteryEvent: {:?}", e);
    } else {
        println!("✅ Test BatteryEvent sent");
    }
        loop {
            // now for the dynamic data:
            let event2 = BatteryEvent {
                device_id: DeviceId(1),
                event: BatteryEventInner::PollDynamicData,
            };

            if let Err(e) = svc.endpoint.send(
                EndpointID::Internal(embedded_services::comms::Internal::Battery),
                &event2,
            ).await {
                println!("❌ Failed to send test BatteryEvent: {:?}", e);
            } else {
                // println!("✅ Test BatteryEvent sent");
            }

            embassy_time::Timer::after(embassy_time::Duration::from_millis(3000)).await;
        }
}

#[embassy_executor::task]
pub async fn event_handler_task(
    obs_static: &'static Mutex<RawMutex, Observation>,
    obs_dynamic: &'static Mutex<RawMutex, Observation>,
    mut controller: &'static mut BatteryController,
    channel: &'static mut BatteryChannelWrapper
) {
    use battery_service::context::BatteryEventInner;

    println!("🛠️  Starting event handler...");


    loop {
        let event = channel.receive().await;
        // println!("🔔 event_handler_task received event: {:?}", event);
        match event.event {
            BatteryEventInner::PollStaticData => {
                // println!("🔄 Handling PollStaticData");
                let _sd  = controller.get_static_data(). await;
                // println!("📊 Static battery data: {:?}", sd);
                let mut obs = obs_static.lock().await;
                obs.mark(ObservationResult::Pass);
            }
            BatteryEventInner::PollDynamicData => {
                // println!("🔄 Handling PollDynamicData");
                let _dd  = controller.get_dynamic_data().await;
                // println!("📊 Dynamic battery data: {:?}", dd);
                let mut obs = obs_dynamic.lock().await;
                obs.mark(ObservationResult::Pass);
            }
            BatteryEventInner::DoInit => {
                println!("⚙️  Handling DoInit");
            }
            BatteryEventInner::Oem(code, data) => {
                println!("🧩 Handling OEM command: code = {code}, data = {:?}", data);
            }
            BatteryEventInner::Timeout => {
                println!("⏰ Timeout event received");
            }
        }
    }
}
```

and then add to the imports for `entry.rs`:
```rust
use crate::battery_tests::{
    init_task,
    battery_service_init_task,
    espi_service_init_task,
    wrapper_task,
    test_message_sender,
    event_handler_task
};
```
Then, create the observers we need for these in `entry_task`:
Place these below the line:
```rust
    let obs_espi = observation_decl!(OBS_ESPI_INIT, "ESPI service init completed");
```
and before `finalize_registry()`;
```rust
    let obs_signal = observation_decl!(OBS_SIGNAL, "Fuel service reports as ready");
    let obs_poll_static = observation_decl!(OBS_POLL_STATIC_RESPONSE, "Battery responded to static poll");
    let obs_poll_dynamic = observation_decl!(OBS_POLL_DYNAMIC_RESPONSE, "Battery responded to dynamic poll");
```
and spawn the tasks, passing the observers.  Here, we will also wait for the signal that the fuel gauge service is ready
before we spawn additional tasks beyond setup.

```rust
    // not used (yet)
    let _ = CHARGER;
    let _ = CHARGER_CONTROLLER;

    let espi_svc = ESPI_SERVICE.init(EspiService::new(battery_channel, charger_channel));
    let espi_svc_init = duplicate_static_mut!(espi_svc, EspiService<'static, BatteryChannelWrapper, ChargerChannelWrapper>);
    let espi_svc_read = duplicate_static_mut!(espi_svc, EspiService<'static, BatteryChannelWrapper, ChargerChannelWrapper>);

    let battery_controller_eh = duplicate_static_mut!(battery_controller, BatteryController);
    let battery_channel_eh = duplicate_static_mut!(battery_channel, BatteryChannelWrapper);
    
    // Spawn independent setup tasks             
    spawner.spawn(init_task(battery_device)).unwrap();
    spawner.spawn(battery_service::task()).unwrap();
    spawner.spawn(battery_service_init_task(battery_fuel, battery_fuel_ready)).unwrap();
    spawner.spawn(espi_service_init_task(obs_espi, espi_svc_init)).unwrap();

    // Wait for fuel to be ready before launching dependent tasks
    println!("⏳ Waiting for BATTERY_FUEL_READY signal...");
    battery_fuel_ready.wait().await;
    println!("🔔 BATTERY_FUEL_READY signaled");
    let mut obs = obs_signal.lock().await;
    obs.mark(ObservationResult::Pass);

    spawner.spawn(wrapper_task(battery_wrapper)).unwrap();
    spawner.spawn(test_message_sender(espi_svc_read)).unwrap();
    spawner.spawn(event_handler_task(obs_poll_static, obs_poll_dynamic,battery_controller_eh, battery_channel_eh)).unwrap();

    spawner.spawn(observations_complete_task()).unwrap();

```

A `cargo run` should show this now:

```
     Running `C:\Users\StevenOhmert\odp\ec_examples\target\debug\battery_charger_subsystem.exe`
🚀 Starting battery + charger integration test
⏳ Waiting for BATTERY_FUEL_READY signal...
🔌 Initializing battery fuel gauge service...
🔋 Launching battery service (single-threaded)
🧩 Registering battery device...
✅🔋 Battery service is up and running.
🔔 BATTERY_FUEL_READY signaled
🛠️  Starting event handler...
✍ Sending test BatteryEvent...
✅ Test BatteryEvent sent
MockBatteryController: Fetching static data
MockBatteryController: Fetching dynamic data
✅ ESPI service init completed: Passed
✅ Fuel service reports as ready: Passed
✅ Battery responded to static poll: Passed
✅ Battery responded to dynamic poll: Passed

Summary: ✅ 4 passed, ❌ 0 failed, ❓ 0 unseen
```

Okay! We pretty much knew the battery tests would pass because this has already been exercised in the `run` experiments of the standalone Battery Project.  But now we have this verified in our integration context.

Now we'll do the same for the Charger before testing the behavior of both together.


