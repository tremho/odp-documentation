# Testing the integrated system behavior
Our tests up to now have tested that we can place the components into the framework and they will respond to messages.  This should
allow an orchestrated power policy that runs over time monitoring conditions and adjusting the charger in response to battery drain
should behave as expected.  Let's test that assumption.

### Simulating the battery over time
We know that we have a simulation in `mock_battery/virtual_battery.rs` (function `tick()`) that will update battery state over a time interval by adjusting charge according to the existing current drain and the amount of charging current applied.

We'll create a `battery_simulation_task` that runs the battery through this simulated time passage while also observing the state of battery charge and marking when it drops below 90% and when it subsequently rises above 90% (after the charger rule has attached the charger).

### Simulating a policy rule for the charger
A true framework will have a power policy handler running as the host service.  Our test framework is taking the place of that here,so we need to supply the policy logic for this ourselves.  Our `charger_rule_task` will be the manager that checks the battery state of charge and makes the decision when to attach or detach the charger.

### Creating the behavior tests
Create a new file for the behavior tests named `behavior_tests.rs` and give it these tasks:
```rust
use ec_common::mutex::{Mutex, RawMutex};
use crate::test_observer::{Observation, ObservationResult};
use ec_common::espi_service::EspiService;
use mock_battery::mock_battery::MockBattery;
use embedded_batteries_async::smart_battery::SmartBattery;
use mock_charger::mock_charger::MockCharger;
use embedded_batteries_async::charger::{MilliAmps, MilliVolts};
use crate::entry::{BatteryChannelWrapper, ChargerChannelWrapper};
use embassy_time::Timer;
use embassy_time::Duration;

#[embassy_executor::task]
pub async fn battery_simulation_task(
    battery: &'static MockBattery,
    charger: &'static MockCharger,
    obs_on: &'static Mutex<RawMutex, Observation>,
    obs_off: &'static Mutex<RawMutex, Observation>,
    multiplier: f32,
) {
    let mut was_on = false;
    let mut was_off = false;

    loop {
        {
            let mut bstate = battery.state.lock().await;
            let cstate = charger.state.lock().await;
            let charger_current = cstate.current();

            if charger_current == 0 {
                // Simulate discharge
                bstate.set_current(-1200);
            }

            // Simulate charging tick
            bstate.tick(charger_current, multiplier);
        }

        Timer::after(Duration::from_secs(1)).await;

        let bstate = battery.state.lock().await;
        let cstate = charger.state.lock().await;
        let rsoc = bstate.relative_soc_percent;
        let chg = cstate.current();

        println!("cap={} chg={}", rsoc, chg);

        let mut on = obs_on.lock().await;
        let mut off = obs_off.lock().await;

        if rsoc < 90 && !was_on && !was_off && chg > 0 {
            on.mark(ObservationResult::Pass);
            println!("on");
            was_on = true;
        } else if rsoc >= 90 && was_on && !was_off && chg == 0 {
            off.mark(ObservationResult::Pass);
            println!("off");
            was_off = true;
        }
    }
}
#[embassy_executor::task]
pub async fn charger_rule_task (
    battery: &'static mut MockBattery,
    svc: &'static mut EspiService<'static, BatteryChannelWrapper, ChargerChannelWrapper>,
) {
    use embedded_services::comms::{EndpointID, Internal};
    use embedded_services::power::policy::charger::{ChargerEvent, PsuState};

    const CURRENT: MilliAmps = 1500;
    const VOLTAGE: MilliVolts = 12600;
    const SOC_THRESHOLD: u8 = 90;

    let mut was_attached = false;

    loop {
        let soc = battery.relative_state_of_charge().await.unwrap();

        // Attach charger if SOC drops below threshold and we're not already attached
        if soc < SOC_THRESHOLD && !was_attached {
            println!("🔌 SOC below threshold. Sending Attach.");
            svc.endpoint.send(
                EndpointID::Internal(Internal::Battery),
                &ChargerEvent::PsuStateChange(PsuState::Attached),
            ).await.unwrap();
            was_attached = true;

        // Detach charger if SOC rises above threshold while we are attached
        } else if soc >= SOC_THRESHOLD && was_attached {
            println!("⚡ SOC above threshold. Sending Detach.");
            svc.endpoint.send(
                EndpointID::Internal(Internal::Battery),
                &ChargerEvent::PsuStateChange(PsuState::Detached),
            ).await.unwrap();
            was_attached = false;
        }

        Timer::after(Duration::from_secs(10)).await;
    }
}
```

Add this to `main.rs`:
```rust
mod behavior_tests;
```

In `entry.rs`, import the tasks:
```rust
use crate::behavior_tests::{
    battery_simulation_task,
    charger_rule_task
};
```

And create our observers and spawn the tasks.  We also need to rearrange our spawn order so that 
our independent charger tests that test charger activation are completed before we start running our behavior tests
because the behavior tests expect the charger to start out in a detached state per the way the simulation is written.

The complete `entry_task()` looks like this:

```rust
#[embassy_executor::task]
pub async fn entry_task(spawner: Spawner) {
    println!("🚀 Starting battery + charger integration test");

    let obs_espi = observation_decl!(OBS_ESPI_INIT, "ESPI service init completed");
    let obs_signal = observation_decl!(OBS_SIGNAL, "Fuel service reports as ready");
    let obs_poll_static = observation_decl!(OBS_POLL_STATIC_RESPONSE, "Battery responded to static poll");
    let obs_poll_dynamic = observation_decl!(OBS_POLL_DYNAMIC_RESPONSE, "Battery responded to dynamic poll");
    let obs_charger_ready = observation_decl!(OBS_CHARGER_READY, "Charger Controller is ready");
    let obs_charger_values = observation_decl!(OBS_CHARGER_VALUES, "Charger Accepts supported values");
    let obs_charger_detach = observation_decl!(OBS_CHARGER_DETACH, "Charger detach zeroes values");
    let obs_charger_rejects = observation_decl!(OBS_CHARGER_REJECTS, "Charger rejects values out of range");
    let obs_attach_msg = observation_decl!(OBS_ATTACH, "Charger sees Attach message");
    let obs_detach_msg = observation_decl!(OBS_DETACH, "Charger sees Detach message");
    let obs_charge_on = observation_decl!(OBS_CHARGE_ON, "Charger Activated"); 
    let obs_charge_off = observation_decl!(OBS_CHARGE_OFF, "Charger Deactivated");
    finalize_registry();

    let battery_device = BATTERY.init(MockBatteryDevice::new(DeviceId(1)));
    let battery_device_mut = duplicate_static_mut!(battery_device, MockBatteryDevice);
    let battery_fuel = BATTERY_FUEL.init(BatteryDevice::new(BatteryDeviceId(1)));
    let battery_fuel_mut = duplicate_static_mut!(battery_fuel, BatteryDevice);
    let inner_battery = battery_device_mut.inner_battery();
    let inner_battery_for_con = duplicate_static_mut!(inner_battery, MockBattery);
    let inner_battery_for_rule = duplicate_static_mut!(inner_battery, MockBattery);

    let battery_controller = BATTERY_CONTROLLER.init(BatteryController::new(inner_battery_for_con));
    let battery_controller_mut = duplicate_static_mut!(battery_controller, BatteryController);
    let battery_channel = BATTERY_EVENT_CHANNEL.init(BatteryChannelWrapper(Channel::new()));
    let charger_channel = CHARGER_EVENT_CHANNEL.init(ChargerChannelWrapper(Channel::new()));
    let battery_fuel_ready = BATTERY_FUEL_READY.init(BatteryFuelReadySignal::new());
    let battery_wrapper = BATTERY_WRAPPER.init(Wrapper::new(battery_fuel_mut, battery_controller_mut));

    let charger_device = CHARGER.init(MockChargerDevice::new (DeviceId(2)));
    let charger_device_mut = duplicate_static_mut!(charger_device, MockChargerDevice);
    let charger_device_mut2 = duplicate_static_mut!(charger_device_mut, MockChargerDevice);
    let inner_charger = charger_device_mut2.inner_charger();
    let inner_charger_for_sim = duplicate_static_mut!(inner_charger, MockCharger);
    let charger_controller = CHARGER_CONTROLLER.init(MockChargerController::new(inner_charger, charger_device));
    let charger_controller_1 = duplicate_static_mut!(charger_controller, MockChargerController);
    let charger_controller_2 = duplicate_static_mut!(charger_controller, MockChargerController);
    let charger_controller_3 = duplicate_static_mut!(charger_controller, MockChargerController);
    let charger_controller_4 = duplicate_static_mut!(charger_controller, MockChargerController);

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

    // Independent charger tests
    spawner.spawn(test_charger_is_ready(obs_charger_ready, charger_controller_1)).unwrap();
    spawner.spawn(test_attach_supported_values(obs_charger_values, charger_controller_2)).unwrap();
    spawner.spawn(test_attach_rejects_out_of_range(obs_charger_rejects, charger_controller_4)).unwrap();

    // Wait for fuel to be ready before launching dependent tasks
    println!("⏳ Waiting for BATTERY_FUEL_READY signal...");
    battery_fuel_ready.wait().await;
    println!("🔔 BATTERY_FUEL_READY signaled");
    let mut obs = obs_signal.lock().await;
    obs.mark(ObservationResult::Pass);

    spawner.spawn(wrapper_task(battery_wrapper)).unwrap();
    spawner.spawn(test_message_sender(espi_svc_read)).unwrap();
    spawner.spawn(cap=99 chg=0 _handler_task(obs_poll_static, obs_poll_dynamic,battery_controller_eh, battery_channel_eh)).unwrap();

    spawner.spawn(test_detach_zeros_state(obs_charger_detach, charger_controller_3)).unwrap();

    let espi_svc_send = duplicate_static_mut!(espi_svc, EspiService<'static, BatteryChannelWrapper, ChargerChannelWrapper>);
    let espi_svc_send2 = duplicate_static_mut!(espi_svc, EspiService<'static, BatteryChannelWrapper, ChargerChannelWrapper>);
    let charger_channel_eh = duplicate_static_mut!(charger_channel, ChargerChannelWrapper);
    spawner.spawn(charger_cap=99 chg=0 _handler_task(obs_attach_msg, obs_detach_msg, charger_controller, charger_channel_eh)).unwrap();
    spawner.spawn(test_charger_message_sender(espi_svc_send2)).unwrap();

    spawner.spawn(battery_simulation_task(
        inner_battery,
        inner_charger_for_sim,
        obs_charge_on,
        obs_charge_off,
        50.0
    )).unwrap();

    spawner.spawn(charger_rule_task(
        inner_battery_for_rule,
        espi_svc_send,
    )).unwrap();


    spawner.spawn(observations_complete_task()).unwrap();
}
```

A `cargo run` here will show all the `println!` output of the tasks as they are encountered. Once the simulation task and charging rule start running, you will see a repeated series of `println!` output of 
```
cap=100 chg=0
cap=99 chg=0 
cap=98 chg=0 
cap=97 chg=0 
cap=96 chg=0 
cap=95 chg=0 
cap=94 chg=0 
cap=93 chg=0 
cap=92 chg=0 
cap=91 chg=0 
cap=90 chg=0 
cap=89 chg=0 
...
```
until at some point below 90 the charger rule kicks in and activates the charger, then the values should start coming back up

```
cap=87 chg=1500
cap=88 chg=1500
cap=89 chg=1500
cap=90 chg=1500
cap=91 chg=1500
```
and at the point it is seen as > 90%, the charger is deactivated again and the test ends.
If the test were allowed to run indefinitely, the values would continually rise and fall to stay within this charge range.

While our charger rule is intentionally simplistic, it effectively demonstrates that behavior orchestration is possible and valid for real-world situations.

```
🚀 Starting battery + charger integration test
⏳ Waiting for BATTERY_FUEL_READY signal...
⚡ Charger attach requested: 3001 mA @ 15001 mV
⚠️ Controller refused requested values: got 0 mA @ 0 mV
⚡ Charger attach requested: 1000 mA @ 5000 mV
⚡ values supplied: 1000 mA @ 5000 mV
✅ Charger is ready.
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
⚡ Charger attach requested: 1000 mA @ 5000 mV
⚡ values supplied: 1000 mA @ 5000 mV
🔌 Charger detached.
🛠️  Starting event handler...
✍ Sending test BatteryEvent...
✅ Test BatteryEvent sent
MockBatteryController: Fetching static data
MockBatteryController: Fetching dynamic data
cap=100 chg=0
cap=100 chg=0
cap=99 chg=0
MockBatteryController: Fetching dynamic data
cap=99 chg=0
cap=99 chg=0
cap=98 chg=0
MockBatteryController: Fetching dynamic data
cap=98 chg=0
cap=98 chg=0
cap=97 chg=0
MockBatteryController: Fetching dynamic data
cap=97 chg=0
cap=96 chg=0
cap=96 chg=0
MockBatteryController: Fetching dynamic data
cap=96 chg=0
cap=95 chg=0
cap=95 chg=0
MockBatteryController: Fetching dynamic data
cap=95 chg=0
cap=94 chg=0
cap=94 chg=0
MockBatteryController: Fetching dynamic data
cap=94 chg=0
cap=93 chg=0
cap=93 chg=0
MockBatteryController: Fetching dynamic data
cap=93 chg=0
cap=92 chg=0
cap=92 chg=0
MockBatteryController: Fetching dynamic data
cap=92 chg=0
cap=91 chg=0
cap=91 chg=0
MockBatteryController: Fetching dynamic data
cap=90 chg=0
cap=90 chg=0
cap=90 chg=0
MockBatteryController: Fetching dynamic data
cap=89 chg=0
cap=89 chg=0
cap=89 chg=0
MockBatteryController: Fetching dynamic data
cap=88 chg=0
cap=88 chg=0
MockBatteryController: Fetching dynamic data
cap=88 chg=0
cap=87 chg=0
cap=87 chg=0
MockBatteryController: Fetching dynamic data
cap=87 chg=0
🔌 SOC below threshold. Sending Attach.
🔔 event_handler_task received event: PsuStateChange(Attached)
🔌 Charger Attached
cap=86 chg=1500
on
cap=86 chg=1500
MockBatteryController: Fetching dynamic data
cap=87 chg=1500
cap=86 chg=1500
cap=87 chg=1500
MockBatteryController: Fetching dynamic data
cap=87 chg=1500
cap=88 chg=1500
cap=87 chg=1500
MockBatteryController: Fetching dynamic data
cap=88 chg=1500
cap=88 chg=1500
cap=88 chg=1500
MockBatteryController: Fetching dynamic data
cap=88 chg=1500
cap=89 chg=1500
cap=88 chg=1500
MockBatteryController: Fetching dynamic data
cap=89 chg=1500
cap=89 chg=1500
cap=90 chg=1500
MockBatteryController: Fetching dynamic data
cap=89 chg=1500
cap=90 chg=1500
cap=90 chg=1500
⚡ SOC above threshold. Sending Detach.
🔔 event_handler_task received event: PsuStateChange(Detached)
⚡ Charger Detached
MockBatteryController: Fetching dynamic data
cap=91 chg=0
off
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
✅ Charger Activated: Passed
✅ Charger Deactivated: Passed

Summary: ✅ 12 passed, ❌ 0 failed, ❓ 0 unseen
```
