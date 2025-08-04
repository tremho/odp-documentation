# Testing the Charger in integration

We didn't create a standalone 'local integration' test for Charger in its standalone project the way we did for Battery -- just the unit tests -- but we we can use these integration tests to connect the charger to our `EspiService` comms and respond to messages
in a similar way.

## Create the `charger_tests.rs` file
Just like we did for the battery tests, we will create and bind a separate file for our charger-related test tasks

Create `charger_tests.rs` and give it this initial content to start off:
```rust
use mock_charger::mock_charger_controller::MockChargerController;
use ec_common::mutex::{Mutex,RawMutex};
use crate::test_observer::{Observation, ObservationResult};
use embedded_services::power::policy::PowerCapability;
use embedded_services::power::policy::charger::{ChargeController, ChargerError};
use mock_charger::virtual_charger::{MAXIMUM_ALLOWED_CURRENT, MAXIMUM_ALLOWED_VOLTAGE};

#[embassy_executor::task]
pub async fn test_charger_is_ready(
    observer: &'static Mutex<RawMutex, Observation>,
    controller: &'static mut MockChargerController
) {
    let result = controller.is_ready().await;
    let mut obs = observer.lock().await;
    if result.is_ok() {
        obs.mark(ObservationResult::Pass);
    }
    else {
        obs.mark(ObservationResult::Fail);
    }
}
#[embassy_executor::task]
pub async fn test_attach_supported_values(
    observer: &'static Mutex<RawMutex, Observation>,
    controller: &'static mut MockChargerController
) {
    let cap = PowerCapability { voltage_mv: 5000, current_ma: 1000 };
    let result = controller.attach_handler(cap).await;
    let mut obs = observer.lock().await;
    if result.is_ok() { 
        obs.mark(ObservationResult::Pass);
    }
    else {
        obs.mark(ObservationResult::Fail);
    }
}
#[embassy_executor::task]
pub async fn test_detach_zeros_state(
    observer: &'static Mutex<RawMutex, Observation>,
    controller: &'static mut MockChargerController
) {
    controller.attach_handler(PowerCapability { voltage_mv: 5000, current_ma: 1000 }).await.unwrap();
    controller.detach_handler().await.unwrap();

    let state = controller.device.inner_charger().state.lock().await;
    let mut obs = observer.lock().await;
    if state.voltage() == 0 && state.current() == 0 {
        obs.mark(ObservationResult::Pass);
    } 
    else {
        obs.mark(ObservationResult::Fail);
    }        
}
#[embassy_executor::task]
pub async fn test_attach_rejects_out_of_range(
    observer: &'static Mutex<RawMutex, Observation>,
    controller: &'static mut MockChargerController
) {
    // Simulates PSU capability values that exceeds allowed thresholds defined by battery
    // which should result in an InvalidState error.

    let cap = PowerCapability {
        voltage_mv: MAXIMUM_ALLOWED_VOLTAGE + 1,
        current_ma: MAXIMUM_ALLOWED_CURRENT + 1,
    };

    let result = controller.attach_handler(cap).await;
    let mut obs = observer.lock().await;
    if matches!(result, Err(ChargerError::InvalidState(_))) {
        obs.mark(ObservationResult::Pass);
    } 
    else {
        obs.mark(ObservationResult::Fail);
    }
}
```
and add to `main.rs`:
```rust
mod charger_tests;
```

Then, in `entry.rs` we can import these test tasks
```rust
use crate::charger_tests::{
    test_charger_is_ready,
    test_attach_supported_values,
    test_detach_zeros_state,
    test_attach_rejects_out_of_range
};
```

Then we can create observers for these and spawn them:
```rust
    let obs_charger_ready = observation_decl!(OBS_CHARGER_READY, "Charger Controller is ready");
    let obs_charger_values = observation_decl!(OBS_CHARGER_VALUES, "Charger Accepts supported values");
    let obs_charger_detach = observation_decl!(OBS_CHARGER_DETACH, "Charger detach zeroes values");
    let obs_charger_rejects = observation_decl!(OBS_CHARGER_REJECTS, "Charger rejects values out of range");
```
We need to create references for `charger_controller` to pass to the spawned tests also:
```rust
    let charger_device = CHARGER.init(MockChargerDevice::new (DeviceId(2)));
    let charger_device_mut = duplicate_static_mut!(charger_device, MockChargerDevice);
    let charger_device_mut2 = duplicate_static_mut!(charger_device_mut, MockChargerDevice);
    let inner_charger = charger_device_mut2.inner_charger();
    let charger_controller = CHARGER_CONTROLLER.init(MockChargerController::new(inner_charger, charger_device));
    let charger_controller_1 = duplicate_static_mut!(charger_controller, MockChargerController);
    let charger_controller_2 = duplicate_static_mut!(charger_controller, MockChargerController);
    let charger_controller_3 = duplicate_static_mut!(charger_controller, MockChargerController);
    let charger_controller_4 = duplicate_static_mut!(charger_controller, MockChargerController);
```
and then the spawns:
```rust
    spawner.spawn(test_charger_is_ready(obs_charger_ready, charger_controller_1)).unwrap();
    spawner.spawn(test_attach_supported_values(obs_charger_values, charger_controller_2)).unwrap();
    spawner.spawn(test_detach_zeros_state(obs_charger_detach, charger_controller_3)).unwrap();
    spawner.spawn(test_attach_rejects_out_of_range(obs_charger_rejects, charger_controller_4)).unwrap();
```
Now we have a good set of charger tests also that we can see pass when we run:
```
     Running `C:\Users\StevenOhmert\odp\ec_examples\target\debug\battery_charger_subsystem.exe`
🚀 Starting battery + charger integration test
⏳ Waiting for BATTERY_FUEL_READY signal...
🔌 Initializing battery fuel gauge service...
🔋 Launching battery service (single-threaded)
🧩 Registering battery device...
✅🔋 Battery service is up and running.
🔔 BATTERY_FUEL_READY signaled
⚡ Charger attach requested: 3001 mA @ 15001 mV
⚠️ Controller refused requested values: got 0 mA @ 0 mV
⚡ Charger attach requested: 1000 mA @ 5000 mV
⚡ values supplied: 1000 mA @ 5000 mV
🔌 Charger detached.
⚡ Charger attach requested: 1000 mA @ 5000 mV
⚡ values supplied: 1000 mA @ 5000 mV
✅ Charger is ready.
🛠️  Starting event handler...
✍ Sending test BatteryEvent...
✅ Test BatteryEvent sent
MockBatteryController: Fetching static data
MockBatteryController: Fetching dynamic data
✅ ESPI service init completed: Passed
✅ Fuel service reports as ready: Passed
✅ Battery responded to static poll: Passed
✅ Battery responded to dynamic poll: Passed
✅ Charger Controller is ready: Passed
✅ Charger Accepts supported values: Passed
✅ Charger detach zeroes values: Passed
✅ Charger rejects values out of range: Passed

Summary: ✅ 8 passed, ❌ 0 failed, ❓ 0 unseen
```

### Attaching the Charger to messages
Although we've implemented the charger in this integration framework, we have not utilized any of the `EspiService` messaging
that we have set aside for the charger.

We have established our `ChargerChannel` for listening to `ChargerEvent` messages, but we are not listening there.

You will recall the `event_handler_task` of the battery is established to listen for and handle `BatteryEvent` messages, so
we can create a similar task for the charger.

Add these task to `charger_tests.rs` for sending, receiving and handling `ChargerEvent` messages:
```rust
#[embassy_executor::task]
pub async fn charger_event_handler_task(
    obs_attach: &'static Mutex<RawMutex, Observation>,
    obs_detach: &'static Mutex<RawMutex, Observation>,
    controller: &'static mut MockChargerController,
    channel: &'static mut ChargerChannelWrapper
) {

    println!("🛠️  Starting ChargerEvent handler...");

    loop {
        let event = channel.receive().await;   
        println!("🔔 event_handler_task received event: {:?}", event); 
        let _ = controller;

        match event {
            ChargerEvent::PsuStateChange(PsuState::Attached) => {
                println!("🔌 Charger Attached");
                let mut obs = obs_attach.lock().await;
                obs.mark(ObservationResult::Pass);
            }
            ChargerEvent::PsuStateChange(PsuState::Detached) => {
                println!("⚡ Charger Detached");
                let mut obs = obs_detach.lock().await;
                obs.mark(ObservationResult::Pass);
            }
            ChargerEvent::Initialized(PsuState::Attached) => {
                println!("✅ Charger Initialized (Attached)");
            }
            ChargerEvent::Initialized(PsuState::Detached) => {
                println!("❗ Charger Initialized (Detached)");
            }
            ChargerEvent::Timeout => {
                println!("⏳ Charger Timeout occurred");
            }
            ChargerEvent::BusError => {
                println!("❌ Charger Bus error occurred");
            }
        }
    }
}

#[embassy_executor::task]
pub async fn test_charger_message_sender(
    svc: &'static mut EspiService<'static, BatteryChannelWrapper, ChargerChannelWrapper>,
) {

    println!("Sending Test ChargerEvents");

    // Simulate charger initialized
    svc.endpoint.send(
        EndpointID::Internal(Internal::Battery),
        &ChargerEvent::Initialized(PsuState::Attached),
    ).await.unwrap();
    println!("Initialized Event Sent");

    // Simulate PSU state change (attached)
    svc.endpoint.send(
        EndpointID::Internal(Internal::Battery),
        &ChargerEvent::PsuStateChange(PsuState::Attached)
    ).await.unwrap();
    println!("PsuStateChange (Attached) Event Sent");

    // Simulate PSU state change
    svc.endpoint.send(
        EndpointID::Internal(Internal::Battery),
        &ChargerEvent::PsuStateChange(PsuState::Detached)
    ).await.unwrap();
    println!("PsuStateChange (Detached) Event Sent");

    // Simulate timeout
    svc.endpoint.send(
        EndpointID::Internal(Internal::Battery),
        &ChargerEvent::Timeout,
    ).await.unwrap();
    println!("Timeout Event Sent");

    // Simulate bus error
    svc.endpoint.send(
        EndpointID::Internal(Internal::Battery),
        &ChargerEvent::BusError,
    ).await.unwrap();
    println!("BusError Event Sent");
}
```
You'll want to add these imports at the top of `charger_tests.rs` also:
```rust
use crate::entry::{BatteryChannelWrapper, ChargerChannelWrapper};
use ec_common::espi_service::EspiService;

use embedded_services::comms::{EndpointID, Internal};
use embedded_services::power::policy::charger::{ChargerEvent, PsuState};
```

Then, in `event.rs`, add the tasks to the imports:
```rust
use crate::charger_tests::{
    test_charger_is_ready,
    test_attach_supported_values,
    test_detach_zeros_state,
    test_attach_rejects_out_of_range,
    charger_event_handler_task,
    test_charger_message_sender
};
```
and create `Observation`s and spawn the task:
```rust
    let obs_attach_msg = observation_decl!(OBS_ATTACH, "Charger sees Attach message");
    let obs_detach_msg = observation_decl!(OBS_DETACH, "Charger sees Detach message");
```
```rust
    let espi_svc_read2 = duplicate_static_mut!(espi_svc, EspiService<'static, BatteryChannelWrapper, ChargerChannelWrapper>);
    let charger_channel_eh = duplicate_static_mut!(charger_channel, ChargerChannelWrapper);
    spawner.spawn(charger_event_handler_task(obs_attach_msg, obs_detach_msg, charger_controller, charger_channel_eh)).unwrap();
    spawner.spawn(test_charger_message_sender(espi_svc_read2)).unwrap();
```
Now with a new `cargo run` we should see confirmation of the Attached and Detached messages being seen:

```
     Running `C:\Users\StevenOhmert\odp\ec_examples\target\debug\battery_charger_subsystem.exe`
🚀 Starting battery + charger integration test
⏳ Waiting for BATTERY_FUEL_READY signal...
🔌 Initializing battery fuel gauge service...
🔋 Launching battery service (single-threaded)
🧩 Registering battery device...
✅🔋 Battery service is up and running.
🔔 BATTERY_FUEL_READY signaled
Sending Test ChargerEvents
Initialized Event Sent
PsuStateChange (Attached) Event Sent
PsuStateChange (Detached) Event Sent
Timeout Event Sent
BusError Event Sent
🛠️  Starting ChargerEvent handler...
🔔 event_handler_task received event: Initialized(Attached)
✅ Charger Initialized (Attached)
🔔 event_handler_task received event: PsuStateChange(Attached)
🔌 Charger Attached
🔔 event_handler_task received event: PsuStateChange(Detached)
⚡ Charger Detached
🔔 event_handler_task received event: Timeout
⏳ Charger Timeout occurred
⚡ Charger attach requested: 3001 mA @ 15001 mV
⚠️ Controller refused requested values: got 0 mA @ 0 mV
⚡ Charger attach requested: 1000 mA @ 5000 mV
⚡ values supplied: 1000 mA @ 5000 mV
🔌 Charger detached.
⚡ Charger attach requested: 1000 mA @ 5000 mV
⚡ values supplied: 1000 mA @ 5000 mV
✅ Charger is ready.
🛠️  Starting event handler...
✍ Sending test BatteryEvent...
✅ Test BatteryEvent sent
MockBatteryController: Fetching static data
MockBatteryController: Fetching dynamic data
✅ ESPI service init completed: Passed
✅ Fuel service reports as ready: Passed
✅ Battery responded to static poll: Passed
✅ Battery responded to dynamic poll: Passed
✅ Charger Controller is ready: Passed
✅ Charger Accepts supported values: Passed
✅ Charger detach zeroes values: Passed
✅ Charger rejects values out of range: Passed
✅ Charger sees Attach message: Passed
✅ Charger sees Detach message: Passed

Summary: ✅ 10 passed, ❌ 0 failed, ❓ 0 unseen
```

### Finishing the simulation
Next we will start testing behaviors that are triggered by messages from the system, and the simulated passage of time.
First, we need to finish the implementation of the charger and its message handler.  Right now, we acknowledge that we receive messages for Attach and Detach of the charger, but we don't call upon the controller to do anything.

Update `charger_event_handler_task` to become this:
```rust
#[embassy_executor::task]
pub async fn charger_event_handler_task(
    obs_attach: &'static Mutex<RawMutex, Observation>,
    obs_detach: &'static Mutex<RawMutex, Observation>,
    controller: &'static mut MockChargerController,
    channel: &'static mut ChargerChannelWrapper
) {

    const APPLIED_CHARGER_CURRENT:MilliAmps= 1500;  
    const APPLIED_CHARGER_VOLTAGE:MilliVolts = 12600;

    println!("🛠️  Starting ChargerEvent handler...");

    loop {
        let event = channel.receive().await;   
        println!("🔔 event_handler_task received event: {:?}", event); 

        match event {
            ChargerEvent::PsuStateChange(PsuState::Attached) => {
                println!("🔌 Charger Attached");
                controller.charging_current(APPLIED_CHARGER_CURRENT).await.unwrap();
                controller.charging_voltage(APPLIED_CHARGER_VOLTAGE).await.unwrap();
                let mut obs = obs_attach.lock().await;
                obs.mark(ObservationResult::Pass);
            }
            ChargerEvent::PsuStateChange(PsuState::Detached) => {
                println!("⚡ Charger Detached");
                controller.charging_current(0).await.unwrap();
                controller.charging_voltage(0).await.unwrap();
                let mut obs = obs_detach.lock().await;
                obs.mark(ObservationResult::Pass);
            }
            ChargerEvent::Initialized(PsuState::Attached) => {
                println!("✅ Charger Initialized (Attached)");
                controller.charging_current(APPLIED_CHARGER_CURRENT).await.unwrap();
                controller.charging_voltage(APPLIED_CHARGER_VOLTAGE).await.unwrap();

            }
            ChargerEvent::Initialized(PsuState::Detached) => {
                println!("❗ Charger Initialized (Detached)");
                controller.charging_current(0).await.unwrap();
                controller.charging_voltage(0).await.unwrap();
            }
            ChargerEvent::Timeout => {
                println!("⏳ Charger Timeout occurred");
            }
            ChargerEvent::BusError => {
                println!("❌ Charger Bus error occurred");
            }
        }
    }
}
```
and add this import at the top:
```rust
use embedded_batteries_async::charger::{Charger, MilliAmps, MilliVolts};
```

Now the charger is activated and deactivated on command.  Let's start writing our behavior tests.

