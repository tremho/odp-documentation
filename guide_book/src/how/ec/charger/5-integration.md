# Integration testing Battery and Charger behavior
Now that both our `MockBattery` and our `MockCharger` have unit tests that test their features individually, we turn our
attention to _Integration Tests_.

## Integration Tests
Integration tests differ from unit tests:
- The tests are primarily designed to test the behavior of one or more system components _in-situ_.
- The test code maintained separate from the code being tested.

### How rust runs tests vs code
Rust defines specific convention for organizing and running code in a project.
By default, code in the `src` directory is considered to be the location that `build` and `run` commands target, and
`test` will run this same code, but gated by the `test` configuration.  This is why we can put unit tests in the same files
as their code sources and have it compiled for execution by the test runner.

We can also put test files in a directory named `tests` and these will also execute by default under a test runner.  However,
files in this location are not compiled with a `#[cfg(test)]` gate in effect, since they are intended only for testing anyway.

Another "special" location for Rust is `src/bin`.  Files in this location can each have their own separate `main()` function and operate as independent executions when targeted by the `run` command.

### Our choices for `mutex.rs`
You may recall that we are using two different threading strategies depending upon whether or not we are executing in a test or not.
We make use of the `embassy::executor` to spawn asynchronous tasks.  

Why the difference?

In our unit test context we are using `std::sync::Arc` because `cargo test` test runner executes in a full host OS environment that includes `std` support. Since we are running `embassy::executor` to spawn our async tasks in a single-threaded fashion, true mutex locking is not necessary -- so we use `NoopRawMutex` as a placeholder.  

In contrast, under normal execution for firmware (even while on the host in `std`) we use `alloc::sync::Arc` and `ThreadModeRawMutex`, which is Embassy's intended approach for embedded single-threaded runtimes.

This distinction allows our integration tests to reflect real behavior without requiring major changes when porting to embedded hardware.

### How we will set up our integration test.
We want to reproduce the basic execution model that we created in `main()`, but do so in a way that serves the goals of an integration test.  Therefore, we want to choose an execution context that is similar to `main()`.

Often, integration tests can be implemented as another variation of unit tests, and placed in the `tests` directory where the test runner of `cargo test` will find them and execute them, and report on the results, along with the unit tests.

While it’s possible to run a continuously executing `embassy::executor` under `cargo test` —- as we’ve done in our test_helper unit test framework —- it can become cumbersome when testing full system behavior. Our integration test reuses nearly the same code structure as `main()`, and runs indefinitely unless manually terminated. For this reason, we define it as a standalone binary and run it using `cargo run --bin`. This avoids constraints from the test harness and gives us full control over execution and output, especially useful in continuous integration contexts.

#### But where?
In order to keep a normal run context (like `main()`) we could put our test code in `src/bin` and then target it by name.  This would be a fine and idiomatic choice.  Still, files in `src/bin` could be constructed for many purposes, and we might want it to be 
semantically quite clear where our integration test is.  So we'll create a directory named `integration`, and within that we'll create a file named `battery_subsystem_behavior.rs`, since that is what we will be testing with it.  This file will have a `main()` entry point and we will target it with `cargo run --bin battery_subsystem_behavior`.  But for that to work outside of the idiomatic `src/bin` location, we need to configure for it.

In `mock_battery/Cargo.toml`, we add this section:

```toml
[[bin]]
name = "battery_subsystem_behavior"
path = "integration/battery_subsystem_behavior.rs"
```

and up in the `[package]` section, add this line
```toml
default-run = "mock_battery"
```

This configures the test target named "battery_subsystem_behavior" to run from the path given.  We've pointed it specifically at our `integration` directory location.  Without this configuration, it would look by default in `src/bin` for the name provided.

The `default-run` line in `[package]` will allow us to continue to use plain `cargo run` without naming a target for our original `main` execution.


### The scope for our tests
For these integration tests, we will want to test the whole of the battery subsystem and how it works within service structure.
The parts of this subystem include
- `MockBatteryDevice` and internal `MockBattery` and `MockCharger` components
- `MockBatteryController` 

and how these work together to monitor the battery and control the charger.

Since we've already done essentially this in our `main.rs` file, we can copy much of the code used there.  But instead of printing
to the console (which we can still do), we will be reporting on whether or not the system behaves as expected for a series of named behaviors.

### Creating a Test Observer
Since we are not running under a `test` context, there is no test runner framework that will report the pass/fail conditions of our test.  Just like our  `main()` code, and just like our unit tests, the Embassy Executor `run()` block that spawns our executing tasks does not exit, so we need to handle that ourselves when all of our test observations are complete.

To help us with all of this, we'll create a `integration/test_observer.rs`.  We keep this in the `integration` folder rather than `src` because it will be used only for integration testing. Give it this code:
```rust
use mock_battery::mutex::{Arc, Mutex, RawMutex};
use std::sync::OnceLock;
use std::vec::Vec;
use core::cell::RefCell;


#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum ObservationResult {
    Unseen,
    #[allow(dead_code)]
    Pass,
    #[allow(dead_code)]
    Fail,
}

pub struct Observation {
    pub name: &'static str,
    pub result: ObservationResult,
}

impl Observation {
    pub const fn new(name: &'static str) -> Self {
        Self {
            name,
            result: ObservationResult::Unseen,
        }
    }

    pub fn mark(&mut self, result: ObservationResult) {
        self.result = result;
    }

    pub fn is_seen(&self) -> bool {
        self.result != ObservationResult::Unseen
    }
}

// Global static registry
static OBSERVATION_REGISTRY: OnceLock<Vec<Arc<Mutex<RawMutex, Observation>>>> = OnceLock::new();

thread_local! {
    static LOCAL_OBSERVATION_REGISTRY: RefCell<Vec<Arc<Mutex<RawMutex, Observation>>>> = RefCell::new(Vec::new());
}

pub fn register_observation(obs: Arc<Mutex<RawMutex, Observation>>) {
    LOCAL_OBSERVATION_REGISTRY.with(|reg| {
        reg.borrow_mut().push(obs);
    });
}

pub fn finalize_registry() {
    let collected = LOCAL_OBSERVATION_REGISTRY.with(|reg| reg.take());
    OBSERVATION_REGISTRY.set(collected).unwrap_or_else(|_| panic!("Observation registry already initialized"));
}

pub fn get_registry() -> &'static [Arc<Mutex<RawMutex, Observation>>] {
    OBSERVATION_REGISTRY.get().expect("Registry not finalized")
}

/// Macro to declare a new static observation and register it in the global registry.
#[macro_export]
macro_rules! observation_decl {
    ($ident:ident, $label:expr) => {{

        static $ident: StaticCell<Arc<Mutex<RawMutex, Observation>>> = StaticCell::new();

        let obs = $ident.init(Arc::new(Mutex::new(Observation::new($label))));
        register_observation(obs.clone());
        obs
    }};
}
/// Checks if all registered observations have been marked (i.e., are not Unseen)
pub async fn all_seen() -> bool {
    for obs in get_registry() {
        let lock = obs.lock().await;
        if !lock.is_seen() {
            return false;
        }
    }
    true
}


/// Print a summary of all registered observations. Returns 0 on full success, -1 if any fail or unseen.
pub async fn summary() -> i32 {
    let registry = get_registry();

    let mut pass = 0;
    let mut fail = 0;
    let mut unseen = 0;

    for obs in registry.iter() {
        let obs = obs.lock().await;
        match obs.result {
            ObservationResult::Pass => {
                println!("✅ {}: Passed", obs.name);
                pass += 1;
            }
            ObservationResult::Fail => {
                println!("❌ {}: Failed", obs.name);
                fail += 1;
            }
            ObservationResult::Unseen => {
                println!("❓ {}: Unseen", obs.name);
                unseen += 1;
            }
        }
    }

    println!("\nSummary: ✅ {} passed, ❌ {} failed, ❓ {} unseen", pass, fail, unseen);

    if fail == 0 && unseen == 0 {
        0
    } else {
        -1
    }
}
```
This defines the concept of a `TestObserver` that contains a collection of `Observations`.  Each `Observation` represents a bit of behavior that will be tested and marked as `Pass` or `Fail`.  Once all the observations have been declared, `finalize_registry()` is called to lock in the collection.  Each of these `Observer` objects are given to the execution tasks that will perform and mark the corresponding behavior.  When all the `Observations` are marked, the `all_seen()` method will return true, and the `summary()` method will print out the results, and return either 0 or -1 to use as an exit code for ending the process.  This mimics the normal output and run behavior of a typical test framework.

We can also continue to use `println!` statements, although these should mostly be used for error reporting only to avoid console clutter, especially if the integration test is going to be executed on a Continuous Integration Server somewhere and logging the output.

## Writing the Integration Test

We want to make a testing version of what we have running in `main`, so let's just copy over the code from main into `integration/battery_subsystem_behavior.rs` as our starting point:

```rust
use embassy_executor::Executor;
use mock_battery::mock_charger::MockCharger;
use static_cell::StaticCell;
use embassy_executor::Spawner;
use battery_service::device::{Device as BatteryDevice, DeviceId as BatteryDeviceId};


use mock_battery::types::BatteryChannel;
use embassy_sync::channel::Channel;
use battery_service::controller::Controller;
use battery_service::wrapper::Wrapper;
use mock_battery::mock_battery_controller::MockBatteryController;
use mock_battery::mock_battery::MockBattery;
use embassy_time::{Timer, Duration};

use embedded_services::power::policy::DeviceId;
use embedded_services::power::policy::register_device;
use mock_battery::mock_battery_device::MockBatteryDevice;

use mock_battery::espi_service;
use mock_battery::fuel_signal_ready::BatteryFuelReadySignal;
use embedded_services::init;

static EXECUTOR: StaticCell<Executor> = StaticCell::new();
static BATTERY: StaticCell<MockBatteryDevice> = StaticCell::new();
static BATTERY_FUEL: StaticCell<BatteryDevice> = StaticCell::new();
static BATTERY_WRAPPER: StaticCell<
        Wrapper<'static, &'static mut MockBatteryController<&'static mut MockBattery, &'static mut MockCharger>>
    > = StaticCell::new();
static CONTROLLER: StaticCell<MockBatteryController<&'static mut MockBattery, &'static mut MockCharger>> = StaticCell::new();
static BATTERY_EVENT_CHANNEL: StaticCell<BatteryChannel> = StaticCell::new();

static BATTERY_FUEL_READY: StaticCell<BatteryFuelReadySignal> = StaticCell::new();


// this is the entry point for integration testing only - not the main app.
fn main() {

    type OurController = MockBatteryController<&'static mut MockBattery, &'static mut MockCharger>;

    let executor = EXECUTOR.init(Executor::new());

    // Construct battery and extract needed values *before* locking any 'static borrows
    let battery = BATTERY.init(MockBatteryDevice::new(DeviceId(1)));
    let battery_for_id: &'static mut MockBatteryDevice = unsafe { &mut *(battery as *const MockBatteryDevice as *mut MockBatteryDevice) };
    let battery_for_inner: &'static mut MockBatteryDevice = unsafe { &mut *(battery as *const MockBatteryDevice as *mut MockBatteryDevice) };
    let battery_for_inner2: &'static mut MockBatteryDevice = unsafe { &mut *(battery as *const MockBatteryDevice as *mut MockBatteryDevice) };
    let battery_for_sim: &'static mut MockBatteryDevice = unsafe { &mut *(battery as *const MockBatteryDevice as *mut MockBatteryDevice) };
    let battery_for_sim2: &'static mut MockBatteryDevice = unsafe { &mut *(battery as *const MockBatteryDevice as *mut MockBatteryDevice) };
    let battery_id = battery_for_id.device().id().0;
    let fuel = BATTERY_FUEL.init(BatteryDevice::new(BatteryDeviceId(battery_id)));
    let battery_fuel_ready = BATTERY_FUEL_READY.init(BatteryFuelReadySignal::new());
    let inner_battery = battery_for_inner.inner_battery();
    let inner_charger = battery_for_inner2.inner_charger();
    let fuel_for_controller = unsafe { &mut *(fuel as *const BatteryDevice as *mut BatteryDevice) };
    let controller = CONTROLLER.init(
        MockBatteryController::<
            &'static mut MockBattery,
            &'static mut MockCharger
        >::new(inner_battery, inner_charger));
    let battery_channel = BATTERY_EVENT_CHANNEL.init(Channel::new());
    let battery_channel_for_handler = unsafe { &mut *(battery_channel as *const BatteryChannel as *mut BatteryChannel) };
    let controller_for_handler = unsafe { &mut *(controller as *const OurController as *mut OurController) };
    let controller_for_poll = unsafe { &mut *(controller as *const OurController as *mut OurController) };

    executor.run(|spawner| { 
        spawner.spawn(init_task(battery)).unwrap();
        spawner.spawn(battery_service::task()).unwrap();
        spawner.spawn(battery_service_init_task(fuel, battery_fuel_ready)).unwrap();
        // spawner.spawn(time_driver::run()). unwrap();
        spawner.spawn(espi_service_init_task (battery_channel)).unwrap();
        spawner.spawn(wrapper_task_launcher(fuel_for_controller, controller, battery_fuel_ready, spawner)).unwrap();
        spawner.spawn(event_handler_task(controller_for_handler, battery_channel_for_handler)).unwrap();
        spawner.spawn(simulation_task(battery_for_sim.inner_battery(), battery_for_sim2.inner_charger(), 50.0)).unwrap();
        spawner.spawn(charger_rule_task(controller_for_poll)).unwrap();
    });
}



#[embassy_executor::task]
async fn init_task(battery:&'static mut MockBatteryDevice) {
    println!("🔋 Launching battery service (single-threaded)");

    init().await;

    println!("🧩 Registering battery device...");
    register_device(battery).await.unwrap();

    println!("✅🔋 Battery service is up and running.");
}

#[embassy_executor::task]
async fn battery_service_init_task(
    dev: &'static mut BatteryDevice,
    ready: &'static BatteryFuelReadySignal
) {
    println!("🔌 Initializing battery fuel gauge service...");
    battery_service::register_fuel_gauge(dev).await.unwrap();
    
    // signal that the battery fuel service is ready
    ready.signal(); 
}

#[embassy_executor::task]
async fn espi_service_init_task(battery_channel: &'static mut BatteryChannel) {
    espi_service::init(battery_channel).await;
}

#[embassy_executor::task]
async fn test_message_sender() {
    use battery_service::context::{BatteryEvent, BatteryEventInner};
    use battery_service::device::DeviceId;
    use embedded_services::comms::EndpointID;

    println!("✍ Sending test BatteryEvent...");

    // Wait a moment to ensure other services are initialized 
    embassy_time::Timer::after(embassy_time::Duration::from_millis(100)).await;

    // Access the ESPI_SERVICE singleton
    let svc = mock_battery::espi_service::get();

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
                println!("✅ Test BatteryEvent sent");
            }

            embassy_time::Timer::after(embassy_time::Duration::from_millis(3000)).await;

        }
}

// }

#[embassy_executor::task]
async fn wrapper_task(wrapper: &'static mut Wrapper<'static, &'static mut MockBatteryController<&'static mut MockBattery, &'static mut MockCharger>>) {
    wrapper.process().await;
}

#[embassy_executor::task]
async fn wrapper_task_launcher(
    fuel: &'static BatteryDevice,
    controller: &'static mut MockBatteryController<&'static mut MockBattery, &'static mut MockCharger>,
    ready: &'static BatteryFuelReadySignal,
    spawner: Spawner,
) {
    println!("🔄 Launching wrapper task...");

    ready.wait().await;
    println!("🔔 BATTERY_FUEL_READY signaled");

    let wrapper = BATTERY_WRAPPER.init(Wrapper::new(fuel, controller));
    spawner.spawn(wrapper_task(wrapper)).unwrap();
    spawner.spawn(test_message_sender()).unwrap();
}

#[embassy_executor::task]
async fn event_handler_task(
    mut controller: &'static mut MockBatteryController<&'static mut MockBattery, &'static mut MockCharger>,
    channel: &'static mut BatteryChannel
) {
    use battery_service::context::BatteryEventInner;

    println!("🛠️  Starting event handler...");

    loop {
        let event = channel.receive().await;
        println!("🔔 event_handler_task received event: {:?}", event);
        match event.event {
            BatteryEventInner::PollStaticData => {
                println!("🔄 Handling PollStaticData");
                let sd  = controller.get_static_data(). await;
                println!("📊 Static battery data: {:?}", sd);
            }
            BatteryEventInner::PollDynamicData => {
                println!("🔄 Handling PollDynamicData");
                let dd  = controller.get_dynamic_data().await;
                println!("📊 Dynamic battery data: {:?}", dd);
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

#[embassy_executor::task]
async fn simulation_task(
    battery: &'static MockBattery,
    charger: &'static MockCharger,
    multiplier: f32
) {
    loop {
        {
            let mut bstate = battery.state.lock().await;        
            let cstate = charger.state.lock().await;

            let charger_current = cstate.current();
            if charger_current == 0 {
                // Simulate current draw (e.g., discharge at 1200 mA)
                bstate.set_current(-1200);
            }
            
            // Advance the simulation by one tick
            println!("calling tick... with charger_current {}", charger_current);
            bstate.tick(charger_current, multiplier);
        }

        // Simulate once per second
        Timer::after(Duration::from_secs(1)).await;
    }
}

#[embassy_executor::task]
async fn charger_rule_task(
    controller: &'static mut MockBatteryController<&'static mut MockBattery, &'static mut MockCharger>
) {
    loop {
        controller.poll_and_manage_charger().await.unwrap();
        let seconds = controller.get_timeout();
        Timer::after(seconds).await;
    }
}
```
when we run `cargo run --bin battery_subsystem_behavior` we should get the same output as we do when running `cargo run`.

But now we want to attach our `TestObserver` helper code and run it as a test of behaviors.

Start by adding this lines at the top of `battery_subsystem_behavior.rs`:

```rust
mod test_observer;
use test_observer::{Observation, ObservationResult, finalize_registry, register_observation, all_seen, summary};
```
and add this `use` statement:

```rust
use mock_battery::mutex::{Arc, Mutex, RawMutex};
```

Now, we want to define the `Observation`s we want to verify for our `TestObserver` framework.

In `main()`, somewhere before the `executor::run` block, declare a series of `Observation`s we will use, like  this:

```rust
    let obs_battery = observation_decl!(OBS_BATTERY_SVC_READY, "Battery Service Ready");
    let obs_fuel = observation_decl!(OBS_FUEL_SVC_READY, "Fuel Gauge Service Ready");
    let obs_espi = observation_decl!(OBS_ESPI_SVC_READY, "Espi Service Ready");
    let obs_fuel_signaled = observation_decl!(OBS_FUEL_SIGNALED, "Fuel Gauge service ready signal received");
    let obs_static_data_received = observation_decl!(OBS_STATIC_DATA_RECEIVED, "Static Data received");
    let obs_dynamic_data_received = observation_decl!(OBS_DYNAMIC_DATA_RECEIVED, "Dynamic Data received");
    let obs_charger_activated = observation_decl!(OBS_CHARGER_ACTIVATED, "Charger activated when capacity < 90%");
    let obs_charger_deactivated = observation_decl!(OBS_CHARGER_DEACTIVATED, "Charger deactivated when capacity >= 90%");

    finalize_registry();
```
Calling `finalize_registry();` at the end completes the collection.

Now, we need to update our tasks so that we pass these `Observation` objects to the tasks that will observe them, 
and each of these tasks will mark the `Observation`s that they are associated with as pass or fail.

We also want to remove many of the superfluous `println`` commands we have here to reduce output clutter.  We will leave `println!` output in the case of reporting errors, however.

```rust
#[embassy_executor::task]
async fn init_task(
    observer: &'static mut Arc<Mutex<RawMutex, Observation>>,
    battery:&'static mut MockBatteryDevice
) {
    // println!("🔋 Launching battery service (single-threaded)");

    embedded_services::init().await;

    // println!("🧩 Registering battery device...");
    register_device(battery).await.unwrap();

    // println!("✅🔋 Battery service is up and running.");
    let mut obs = observer.lock().await;
    obs.mark(ObservationResult::Pass);
}

#[embassy_executor::task]
async fn battery_service_init_task(
    observer: &'static mut Arc<Mutex<RawMutex, Observation>>,
    dev: &'static mut BatteryDevice,
    ready: &'static BatteryFuelReadySignal
) {
    // println!("🔌 Initializing battery fuel gauge service...");
    battery_service::register_fuel_gauge(dev).await.unwrap();

    let mut obs = observer.lock().await;
    obs.mark(ObservationResult::Pass);
    
    // signal that the battery fuel service is ready
    ready.signal(); 
}

#[embassy_executor::task]
async fn espi_service_init_task(
    observer: &'static mut Arc<Mutex<RawMutex, Observation>>,
    battery_channel: &'static mut BatteryChannel) {
    espi_service::init(battery_channel).await;
    let mut obs = observer.lock().await;
    obs.mark(ObservationResult::Pass);
}

#[embassy_executor::task]
async fn test_message_sender(
) {
    use battery_service::context::{BatteryEvent, BatteryEventInner};
    use battery_service::device::DeviceId;
    use embedded_services::comms::EndpointID;

    // println!("✍ Sending test BatteryEvent...");

    // Wait a moment to ensure other services are initialized 
    embassy_time::Timer::after(embassy_time::Duration::from_millis(100)).await;

    // Access the ESPI_SERVICE singleton
    let svc = mock_battery::espi_service::get();

    let event = BatteryEvent {
        device_id: DeviceId(1),
        event: BatteryEventInner::PollStaticData, // or DoInit, PollDynamicData, etc.
    };
    
    if let Err(e) = svc.endpoint.send(
        EndpointID::Internal(embedded_services::comms::Internal::Battery),
        &event,
    ).await {
        println!("❌ Failed to send PollStaticData: {:?}", e);
    } else {
        // println!("✅ PollStaticData sent");
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
                println!("❌ Failed to send PollDynamicData: {:?}", e);
            } else {
                // println!("✅ PollDynamicData sent");
            }

            embassy_time::Timer::after(embassy_time::Duration::from_millis(3000)).await;

        }
}


#[embassy_executor::task]
async fn wrapper_task(wrapper: &'static mut Wrapper<'static, &'static mut MockBatteryController<&'static mut MockBattery, &'static mut MockCharger>>) {
    wrapper.process().await;
}

#[embassy_executor::task]
async fn wrapper_task_launcher(
    fsig_obsv: &'static mut Arc<Mutex<RawMutex, Observation>>,
    fuel: &'static BatteryDevice,
    controller: &'static mut MockBatteryController<&'static mut MockBattery, &'static mut MockCharger>,
    ready: &'static BatteryFuelReadySignal,
    spawner: Spawner,
) {
    // println!("🔄 Launching wrapper task...");

    ready.wait().await;
    // println!("🔔 BATTERY_FUEL_READY signaled");
    let mut obs = fsig_obsv.lock().await;
    obs.mark(ObservationResult::Pass);

    let wrapper = BATTERY_WRAPPER.init(Wrapper::new(fuel, controller));
    spawner.spawn(wrapper_task(wrapper)).unwrap();
    spawner.spawn(test_message_sender(
        // stat_obsv, 
        // dyn_obsv
    )).unwrap();
}

#[embassy_executor::task]
async fn event_handler_task(
    stat_obsv: &'static mut Arc<Mutex<RawMutex, Observation>>,
    dyn_obsv: &'static mut Arc<Mutex<RawMutex, Observation>>,
    mut _controller: &'static mut MockBatteryController<&'static mut MockBattery, &'static mut MockCharger>,
    channel: &'static mut BatteryChannel
) {
    use battery_service::context::BatteryEventInner;

    // println!("🛠️  Starting event handler...");

    loop {
        let event = channel.receive().await;
        // println!("🔔 event_handler_task received event: {:?}", event);
        match event.event {
            BatteryEventInner::PollStaticData => {
                // println!("🔄 Handling PollStaticData");
                // let sd  = controller.get_static_data(). await;
                // println!("📊 Static battery data: {:?}", sd);
                let mut sobs = stat_obsv.lock().await;
                sobs.mark(ObservationResult::Pass)
            }
            BatteryEventInner::PollDynamicData => {
                // println!("🔄 Handling PollDynamicData");
                // let dd  = controller.get_dynamic_data().await;
                // println!("📊 Dynamic battery data: {:?}", dd);
                let mut dobs = dyn_obsv.lock().await;
                dobs.mark(ObservationResult::Pass);
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

#[embassy_executor::task]
async fn simulation_task(
    charger_active_obsv: &'static mut Arc<Mutex<RawMutex, Observation>>,
    charger_deactive_obsv: &'static mut Arc<Mutex<RawMutex, Observation>>,
    battery: &'static MockBattery,
    charger: &'static MockCharger,
    multiplier: f32
) {
    let mut was_on = false;
    let mut was_off = false;
    loop {
        {
            let mut bstate = battery.state.lock().await;        
            let cstate = charger.state.lock().await;

            let charger_current = cstate.current();
            if charger_current == 0 {
                // Simulate current draw (e.g., discharge at 1200 mA)
                bstate.set_current(-1200);
            }
            
            // Advance the simulation by one tick
//            println!("calling tick... with charger_current {}", charger_current);
            bstate.tick(charger_current, multiplier);
        }

        // Simulate once per second
        Timer::after(Duration::from_secs(1)).await;

        // TODO: Monitor and watch for charger activation/deactivation
        let bstate = battery.state.lock().await;
        let cstate = charger.state.lock().await;
        let rsoc = bstate.relative_soc_percent;
        let chg = cstate.current();
        let mut obs_on = charger_active_obsv.lock().await;
        let mut obs_off = charger_deactive_obsv.lock().await;
        
        // provide a little bit of feedback while it is running
        println!("cap={} chg={}",rsoc, chg);

        if rsoc < 90 {
            if !was_on && !was_off && chg > 0 {
                obs_on.mark(ObservationResult::Pass);
                println!("on");
                was_on = true;
            }
        }
        else {
            if was_on && !was_off && chg == 0 {
                obs_off.mark(ObservationResult::Pass);
                println!("off");
                was_off = true
            }
        }
    }
}

#[embassy_executor::task]
async fn charger_rule_task(
    controller: &'static mut MockBatteryController<&'static mut MockBattery, &'static mut MockCharger>
) {
    loop {
        controller.poll_and_manage_charger().await.unwrap();
        let seconds = controller.get_timeout();
        Timer::after(seconds).await;
    }
}
```

We also want to create a new task that will wait for all the `Observation` tests to be complete, then print a summary and exit:

```rust
#[embassy_executor::task]
async fn observations_complete_task() {
    loop {
        let ready = all_seen().await;
        if ready {
            let exit_code = summary().await;
            std::process::exit(exit_code);
        }

        Timer::after(Duration::from_secs(1)).await;

    }
    
}
```

Now we need to update all of our calls to these tasks in the `spawn block of `main()` so these `Observer` values are passed:

```rust
    executor.run(|spawner| { 
        
        spawner.spawn(init_task(
            obs_battery, 
            battery
        )).unwrap();
        
        spawner.spawn(battery_service::task(

        )).unwrap();
        
        spawner.spawn(battery_service_init_task(
            obs_fuel, 
            fuel, 
            battery_fuel_ready
        )).unwrap();

        spawner.spawn(espi_service_init_task (
            obs_espi,
            battery_channel
        )).unwrap();
        
        spawner.spawn(wrapper_task_launcher(
            obs_fuel_signaled,
            fuel_for_controller,
            controller, 
            battery_fuel_ready, 
            spawner
        )).unwrap();
        
        spawner.spawn(event_handler_task(
            obs_static_data_received,
            obs_dynamic_data_received,
            controller_for_handler,
            battery_channel_for_handler
        )).unwrap();
        
        spawner.spawn(simulation_task(
            obs_charger_activated,
            obs_charger_deactivated,
            battery_for_sim.inner_battery(),
            battery_for_sim2.inner_charger(),
            50.0
        )).unwrap();

        spawner.spawn(charger_rule_task(
            controller_for_poll
        )).unwrap();

        spawner.spawn(observations_complete_task(
        )).unwrap();
    });
```
Now, when run via `cargo run --bin battery_subsystem_behavior`, you should first see the minimal feedback output we included in a `println!` as the simulation behaviors are evaluated:

```
cap=93 chg=0
```
until the charge capacity drops below 90% and the charger rules turn on the charger, then you should see output like
```
cap=89, chg=1500
```
continue until the charger rules find the capacity >= 90% and turn the charger off again. At that point the test ends and you will see the summary output:
```
✅ Battery Service Ready: Passed
✅ Fuel Gauge Service Ready: Passed
✅ Espi Service Ready: Passed
✅ Fuel Gauge service ready signal received: Passed
✅ Static Data received: Passed
✅ Dynamic Data received: Passed
✅ Charger activated when capacity < 90%: Passed
✅ Charger deactivated when capacity >= 90%: Passed

Summary: ✅ 8 passed, ❌ 0 failed, ❓ 0 unseen
```




