
## Continuing with the integration project
That refactor may have felt extensive, but it puts us on a much better trajectory for now and for integrations yet to come.

So go back to our `battery_charger_subsystem` project.

In `battery_charger_subsystem/Cargo.toml`, we add this:

```toml
# Battery-Charger Subsystem 
[package]
name = "battery_charger_subsystem"
version = "0.1.0"
edition = "2021"

[dependencies]
embedded-batteries-async = { path = "../embedded-batteries/embedded-batteries-async" }
embassy-executor = { path = "../embassy/embassy-executor",  features = ["arch-std", "executor-thread"], default-features = false }
embassy-time = { path = "../embassy/embassy-time", features = ["std"] }
embassy-sync = { path = "../embassy/embassy-sync", features = ["std"] }
embassy-futures = { path = "../embassy/embassy-futures" }
embassy-time-driver = { path = "../embassy/embassy-time-driver" }
embassy-time-queue-utils = { path = "../embassy/embassy-time-queue-utils" }

embedded-services = { path = "../embedded-services/embedded-service" }
battery-service = { path = "../embedded-services/battery-service" }

ec_common = { path = "../ec_common"}
mock_battery = { path = "../battery_project/mock_battery", default-features = false}
mock_charger = { path = "../charger_project/mock_charger", default-features = false}

static_cell = "2.1"


[patch.'https://github.com/embassy-rs/embassy']
embassy-time = { path = "../embassy/embassy-time" }
embassy-time-driver = { path = "../embassy/embassy-time-driver" }
embassy-sync = { path = "../embassy/embassy-sync" }
embassy-executor = { path = "../embassy/embassy-executor" }
embassy-futures = { path = "../embassy/embassy-futures" }

[patch.crates-io]
embedded-batteries-async = { path = "../embedded-batteries/embedded-batteries-async" }

[features]
default = ["thread-mode"]
thread-mode = [
    "mock_battery/thread-mode",
    "mock_charger/thread-mode",
]
noop-mode = [
    "mock_battery/noop-mode",
    "mock_charger/noop-mode",
]
```


### Getting started
We'll start out with a `main.rs` that looks like this:
```rust
// main.rs 

use embassy_executor::Spawner;

mod entry;

#[embassy_executor::main]
async fn main(spawner: Spawner) {
    spawner.spawn(entry::entry_task(spawner)).unwrap();
}
```
This will just spawn our asynchronous entry point, which it expects to find in a new file `entry.rs`, that we will create now:
```rust
use embassy_executor::Spawner;

#[embassy_executor::task]
pub async fn entry_task(spawner: Spawner) {
    println!("🚀 Starting battery + charger integration test");
    let _ = spawner;
}
```
Now, build and run this with `cargo run`

```
     Running `target\debug\battery_charger_subsystem.exe`
🚀 Starting battery + charger integration test
```
This code currently does not exit on its own and you have to enter Ctrl-C to signal an exit because the `embassy-executor` run loop does not exit.  
This will change when we introduce our `TestObserver` to help us out with our test tasks.

Create `test_observer.rs` and give it this content:
```rust
// test_observer.rs 
use ec_common::mutex::{Mutex, RawMutex};
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
static OBSERVATION_REGISTRY: OnceLock<Vec<&'static Mutex<RawMutex, Observation>>> = OnceLock::new();

thread_local! {
    static LOCAL_OBSERVATION_REGISTRY: RefCell<Vec<&'static Mutex<RawMutex, Observation>>> = RefCell::new(Vec::new());
}

pub fn register_observation(obs: &'static Mutex<RawMutex, Observation>) {
    LOCAL_OBSERVATION_REGISTRY.with(|reg| {
        reg.borrow_mut().push(obs);
    });
}

pub fn finalize_registry() {
    let collected = LOCAL_OBSERVATION_REGISTRY.with(|reg| reg.take());
    OBSERVATION_REGISTRY.set(collected).unwrap_or_else(|_| panic!("Observation registry already initialized"));
}

pub fn get_registry() -> &'static Vec<&'static Mutex<RawMutex, Observation>> {
    OBSERVATION_REGISTRY.get().expect("Registry not finalized")
}

/// Macro to declare a new static observation and register it in the global registry.
#[macro_export]
macro_rules! observation_decl {
    ($ident:ident, $label:expr) => {{
        static $ident: StaticCell<Mutex<RawMutex, Observation>> = StaticCell::new();
        let obs_ref: &'static Mutex<RawMutex, Observation> = $ident.init(Mutex::new(Observation::new($label)));
        register_observation(obs_ref);
        obs_ref
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

### Adding to `main.rs`
In previous examples, we made .rs files available for import by referencing them in `lib.rs`.  But here we are doing it differently.
Add the following to your `main.rs` file, near the top:
```rust
mod entry;
mod test_observer;
```
This will bind all of these modules to the current `crate`.


### Using the TestObserver
Before we write actual test tasks, let's create a couple of examples that we can use to show the pattern of using the `TestObserver` we created for this.

The `TestObserver` is used to collect a number of `Observation`s that represent a given test.  Each of these observations may be pending (`Unseen`) or may conclude with a `Pass` or `Fail`.  When all the `Observation`s have concluded, a printed output of the results is produced, and the program exits.

Each Observation is typically assigned to a separate async task that marks the associated `Observation` with its `Pass`/`Fail` status.

#### A couple of example test tasks to set the pattern
We are just going to show the `TestObserver` in action, so we will create these two test tasks in `entry.rs`:
```rust
#[embassy_executor::task]
async fn example_pass(
    observer: &'static Mutex<RawMutex, Observation>
) {
    let mut obs = observer.lock().await;
    obs.mark(ObservationResult::Pass);
}
#[embassy_executor::task]
async fn example_fail(
    observer: &'static Mutex<RawMutex, Observation>
) {
    let mut obs = observer.lock().await;
    obs.mark(ObservationResult::Fail);
}
```
We also need a final task that will tell us when the tests are complete.  Add this task to the end of `entry.rs` as well:
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
Now replace the top part of your `entry.rs` down through the `entry_task` with this updated version:
```rust
use embassy_executor::Spawner;
use static_cell::StaticCell;
use ec_common::mutex::{Mutex,RawMutex};
use crate::test_observer::{Observation, ObservationResult, register_observation, finalize_registry, all_seen, summary};
use crate::observation_decl;
use embassy_time::{Timer, Duration};


#[embassy_executor::task]
pub async fn entry_task(spawner: Spawner) {
    println!("🚀 Starting battery + charger integration test");

    let obs_pass = observation_decl!(OBS_PASS, "Example passing test");
    let obs_fail = observation_decl!(OBS_FAIL, "Example failing test");

    finalize_registry();

    spawner.must_spawn(example_pass(obs_pass));
    spawner.must_spawn(example_fail(obs_fail));
    spawner.spawn(observations_complete_task()).unwrap();

}
```
This demonstrates the pattern used to add a test task and execute it:
1. Declare an `Observation` using `observation_decl` 
2. Call `finalize_registry()` when all `Observation`s are declared
3. Spawn each of the tasks, passing in the appropriate `Observation`
4. Spawn the `observation_complete_task` as one of the spawned tasks.

When you run this with `cargo run` you should see:
```
     Running `target\debug\battery_charger_subsystem.exe`
🚀 Starting battery + charger integration test
✅ Example passing test: Passed
❌ Example failing test: Failed

Summary: ✅ 1 passed, ❌ 1 failed, ❓ 0 unseen
error: process didn't exit successfully: `target\debug\battery_charger_subsystem.exe` (exit code: 0xffffffff)
```
If we eliminate the fail test from this set, we get instead:
```
     Running `target\debug\battery_charger_subsystem.exe`
🚀 Starting battery + charger integration test
✅ Example passing test: Passed

Summary: ✅ 1 passed, ❌ 0 failed, ❓ 0 unseen
```
With a clean exit code (0).  Exit code -1 is used if there is a test failure.


## Some real tests
We now have our test setup established, and we can write some actual test tasks now to check the integration.

Our first test is a bit of a sanity test -- we want to ensure that we can instantiate and compose our components without a panic.

As we know, we need to allocate our components as `StaticCell` and call `init` to get the instance, and we know that if we
need to use one of those instances more than once we may encounter a borrow violation and need to use our `duplicate_static_mut!` safety assertion.  The ability to make these allocations is a test in itself -- if anything panics it will stop and fail the test.
We can't do these allocations per test task because we can only call `StaticCell::init()` once, so it makes sense to allocate
everything we think we might need for the tasks, and then pass what that task will need when we write those tests.

### Some helpers we've used before
We are going to need some of the helper utilities we used in the previous projects here too, so we'll copy / create / modify those files as needed here:

We need to add these to `main.rs`:
```rust
mod entry;
mod mutex;
mod test_observer;
mod mut_copy;
mod types;
```


Now let's set up our `entry.rs` to provide the allocations and verify all that is working.
```rust
use embassy_executor::Spawner;
use static_cell::StaticCell;
use ec_common::mutex::{Mutex,RawMutex};
use ec_common::duplicate_static_mut;
use crate::test_observer::{Observation, ObservationResult, register_observation, finalize_registry, all_seen, summary};
use crate::observation_decl;
use embassy_time::{Timer, Duration};

use ec_common::fuel_signal_ready::BatteryFuelReadySignal;
use mock_battery::mock_battery_device::MockBatteryDevice;
use mock_charger::mock_charger_device::MockChargerDevice;
use mock_battery::mock_battery::MockBattery;

use embedded_services::power::policy::DeviceId;

use battery_service::device::{Device as BatteryDevice, DeviceId as BatteryDeviceId};
use battery_service::wrapper::Wrapper;

use ec_common::espi_service::{EspiService, EventChannel, MailboxDelegateError};


use embassy_sync::channel::Channel;
use battery_service::context::BatteryEvent;
use embedded_services::power::policy::charger::{
    ChargerEvent
};

pub struct BatteryChannelWrapper(pub Channel<RawMutex, BatteryEvent, 4>);

impl BatteryChannelWrapper {
    #[allow(unused)]
    pub async fn receive(&mut self) -> BatteryEvent {
        self.0.receive().await
    }
}
impl EventChannel for BatteryChannelWrapper {
    type Event = BatteryEvent;
    fn try_send(&self, event: BatteryEvent) -> Result<(), MailboxDelegateError> {
        self.0.try_send(event).map_err(|_| MailboxDelegateError::MessageNotFound)
    }
}
pub struct ChargerChannelWrapper(pub Channel<RawMutex, ChargerEvent, 4>);

impl ChargerChannelWrapper {
    #[allow(unused)]
    pub async fn receive(&mut self) -> ChargerEvent {
        self.0.receive().await
    }
}
impl EventChannel for ChargerChannelWrapper {
    type Event = ChargerEvent;
    fn try_send(&self, event: ChargerEvent) -> Result<(), MailboxDelegateError> {
        self.0.try_send(event).map_err(|_| MailboxDelegateError::MessageNotFound)
    }
}
use mock_battery::mock_battery_controller::MockBatteryController;
use mock_charger::mock_charger_controller::MockChargerController;

type BatteryController = MockBatteryController<&'static mut MockBattery>;


static BATTERY: StaticCell<MockBatteryDevice> = StaticCell::new();
static BATTERY_FUEL: StaticCell<BatteryDevice> = StaticCell::new();
static BATTERY_EVENT_CHANNEL: StaticCell<BatteryChannelWrapper> = StaticCell::new();
static BATTERY_WRAPPER: StaticCell<
        Wrapper<'static, &'static mut BatteryController>
    > = StaticCell::new();
static BATTERY_CONTROLLER: StaticCell<BatteryController> = StaticCell::new();
static ESPI_SERVICE: StaticCell<EspiService<'static, BatteryChannelWrapper, ChargerChannelWrapper>> = StaticCell::new();
static BATTERY_FUEL_READY: StaticCell<BatteryFuelReadySignal> = StaticCell::new();

static CHARGER: StaticCell<MockChargerDevice> = StaticCell::new();
static CHARGER_CONTROLLER:StaticCell<MockChargerController> = StaticCell::new();


#[embassy_executor::task]
pub async fn entry_task(spawner: Spawner) {
    println!("🚀 Starting battery + charger integration test");

    let obs_pass = observation_decl!(OBS_PASS, "Example Pass");
    finalize_registry();

    let battery_device = BATTERY.init(MockBatteryDevice::new(DeviceId(1)));
    let battery_device_mut = duplicate_static_mut!(battery_device, MockBatteryDevice);
    let battery_fuel = BATTERY_FUEL.init(BatteryDevice::new(BatteryDeviceId(1)));
    let battery_fuel_mut = duplicate_static_mut!(battery_fuel, BatteryDevice);
    let inner_battery = battery_device_mut.inner_battery();
    let inner_battery_for_con = duplicate_static_mut!(inner_battery, MockBattery);

    let battery_controller = BATTERY_CONTROLLER.init(BatteryController::new(inner_battery_for_con));
    let battery_controller_mut = duplicate_static_mut!(battery_controller, BatteryController);
    let battery_channel = BATTERY_EVENT_CHANNEL.init(BatteryChannelWrapper(Channel::new()));
    let battery_fuel_ready = BATTERY_FUEL_READY.init(BatteryFuelReadySignal::new());
    let battery_wrapper = BATTERY_WRAPPER.init(Wrapper::new(battery_fuel_mut, battery_controller_mut));

    // we don't use these (yet)
    let _ = ESPI_SERVICE;
    let _ = CHARGER;
    let _ = CHARGER_CONTROLLER;
    let _ = battery_wrapper;
    let _ = battery_channel; 
    let _ = battery_fuel_ready;


    spawner.spawn(example_pass(obs_pass)).unwrap();
    spawner.spawn(observations_complete_task()).unwrap();

}

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
#[embassy_executor::task]
async fn example_pass (
    observer: &'static Mutex<RawMutex, Observation>
) {
    let mut obs = observer.lock().await;
    obs.mark(ObservationResult::Pass);
}
```

Here we have set up the StaticCell allocations we will need to integrate for both our Battery and Charger components.

This test will run and report success after it has allocated most of what we will need for upcoming test tasks,
so we are now in a good starting position.



