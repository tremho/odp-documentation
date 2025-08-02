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

### How we will set up our integration test.
You may recall that the battery example's `main()` function invokes `embassy-executor` to spawn a series of asynchronous tasks, because this reflects how the code is meant to operate in an integrated embedded environment.  You will also recall the use of our `test_helper.rs` in both the battery and the charger examples to give us essentially the same async model for testing.

We will be using a similar technique for this combined integration, in a way that serves the goals of an integration test.  

Accordingly, we will not be using the `test` features of Rust, but rather creating a normal runnable program to execute the testing behaviors.  

Often, integration tests can be implemented as another variation of unit tests, and placed in the `tests` directory where the test runner of `cargo test` will find them and execute them, and report on the results, along with the unit tests.

But we will choose to not use this method, and just run our tests with `cargo run` because as we've already seen the async nature of our code undermines the usefulness of each `#[test]` block. We want each of our tasks to be independently observable.  To do that we will be creating a `TestObserver` for reporting our pass/fail results.

#### But where?
We will create a new project space for this.  Alongside your `battery_project` and `charger_project` directories, create a new one named `battery_charger_subsystem`.  Go ahead and populate the new project with some starting files (these can be empty at first), so that your setup looks something like this:
```
ec_examples/
├── battery_project/
├── charger_project/
├── battery_charger_subsystem/
│   ├── src/
│   │   ├── lib.rs
│   │   ├── main.rs
│   │   ├── policy.rs       
│   │   ├── test_observer.rs
│   └── Cargo.toml
```

You can construct the `battery_charger_subsystem` structure with these commands from a `cmd` prompt:
```cmd
mkdir battery_charger_subsystem
cd battery_charger_subsystem
echo # Battery-Charger Subsystem > Cargo.toml
mkdir src
cd src
echo // lib.rs > lib.rs
echo // main.rs > main.rs
echo // policy.rs > policy.rs
echo // test_observer.rs > test_observer.rs
```

## A note on dependency structuring
Up to this point we've been treating each component project as a standalone effort, and in that respect all of the dependent repositories are brought in as submodules _within_ each project.  For battery and charger, these dependencies are nearly identical.
In retrospect, it would probably have been better to place these dependencies outside of the component project spaces so they could share the same resources. That would have been especially helpful now that we are here at integration.

In fact, it becomes _imperative_ that we remedy this structure before we continue to insure all the components in question and the test code itself are relying on the same versions of the dependent code. Even a minor difference that would cause no trouble for execution in any version of the dependencies may be enough to halt building if Rust senses a version drift.

## ⚠️⚒ Refactoring detour ⚒⚠️
We need to bite the bullet and remedy this before we continue.  It won't take too long.
First, identify the containing folder you have your `battery_project` and `charger_project` files in.
We are going to turn this folder into an unattached `git` folder the same way we did for the projects and bring the submodules in at this level.  If your containing folder is not appropriate for this, create a new folder (mine is named `ec_examples`) and move your project folders into here before continuing.

Now, in the containing folder (`ec_examples`), perform the following:
```
git init
git submodule add https://github.com/embassy-rs/embassy.git 
git submodule add https://github.com/OpenDevicePartnership/embedded-batteries
git submodule add https://github.com/OpenDevicePartnership/embedded-services
git submodule add https://github.com/OpenDevicePartnership/embedded-cfu
git submodule add https://github.com/OpenDevicePartnership/embedded-usb-pd
```

now, go into your battery_project and at the root of this project, execute these commands to remove its internal submodules:
```cmd
git submodule deinit -f embassy
git rm -f embassy
git submodule deinit -f embedded-batteries
git rm -f embedded-batteries
git submodule deinit -f embedded-services
git rm -f embedded-services
git submodule deinit -f embedded-cfu
git rm -f embedded-cfu
git submodule deinit -f embedded-usb-pd
git rm -f embedded-usb-pd
```
Now in both your `battery_project/Cargo.toml` and your `battery_project/mock_battery/Cargo.toml` change all path references to `embassy`, or `embedded-`anything by prepending a `../` to their path.  This will point these to our new location in the container.

> 📦 **Dependency Overrides**
>
> Because some crates (like `battery-service`) pull in Embassy as a Git dependency, while we use a local path-based submodule, we must unify them using a `[patch]` section in our `Cargo.toml`.
>
> This ensures all parts of our build use the *same single copy* of Embassy, which is critical to avoid native-linking conflicts like `embassy-time-driver`.

Add this to the bottom of your top-level `Cargo.toml` (`battery_project/Cargo.toml`):
```toml
[patch.'https://github.com/embassy-rs/embassy']
embassy-time = { path = "../embassy/embassy-time" }
embassy-time-driver = { path = "../embassy/embassy-time-driver" }
embassy-sync = { path = "../embassy/embassy-sync" }
embassy-executor = { path = "../embassy/embassy-executor" }
embassy-futures = { path = "../embassy/embassy-futures" }
```

and add this line to the bottom of your `[patch.crates-io]` section
```toml
embedded-batteries-async = { path = "../embedded-batteries/embedded-batteries-async" }
```

Now, still in `battery_project` insure you can still build with `cargo clean` and `cargo build`

### Do the same for charger_project
We want to follow the exact same steps for the charger project:
- switch to that project directory (`charger_project`)
- Execute the same submodule removal commands we used for the battery_project
- Prepend `../` to all the path names for `embassy` and `embedded-`* in the `Cargo.toml` files
- add the `[patch.'https://github.com/embassy-rs/embassy']` section from above to the top-level `Cargo.toml`
- add the `embedded-batteries-async` fixup line to the `[path.crates.io]` as we did above.

Ensure `charger_project` builds clean in its new form.

## Continuing with the integration project
Okay. That really wasn't so bad, and now we are on track to complete our mini-integration of the battery-charger subsystem, and we are also on a better track for the future and integrations yet to come.

So go back to our `battery_charger_subsystem` project.

In `battery_charger_subsystem/Cargo.toml`, we add this:

```toml
# Battery-Charger Subsystem 
[package]
name = "battery_charger_subsystem"
version = "0.1.0"
edition = "2021"

[dependencies]
embassy-executor = { path = "../embassy/embassy-executor",  features = ["arch-std", "executor-thread"], default-features = false }
embassy-time = { path = "../embassy/embassy-time", features = ["std"] }
embassy-sync = { path = "../embassy/embassy-sync", features = ["std"] }
embassy-futures = { path = "../embassy/embassy-futures" }
embassy-time-driver = { path = "../embassy/embassy-time-driver" }
embassy-time-queue-utils = { path = "../embassy/embassy-time-queue-utils" }

mock_battery = { path = "../battery_project/mock_battery" }
mock_charger = { path = "../charger_project/mock_charger" }

[patch.'https://github.com/embassy-rs/embassy']
embassy-time = { path = "../embassy/embassy-time" }
embassy-time-driver = { path = "../embassy/embassy-time-driver" }
embassy-sync = { path = "../embassy/embassy-sync" }
embassy-executor = { path = "../embassy/embassy-executor" }
embassy-futures = { path = "../embassy/embassy-futures" }

[patch.crates-io]
embedded-batteries-async = { path = "../embedded-batteries/embedded-batteries-async" }
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
This will just spawn our asynchronous entry point, whic it expects to find in a new file `entry.rs`, that we will create now:
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
This code currently does not exit and you have to enter Ctrl-C to break because the `embassy-executor` run loop does not exit.  
This will change when we introduce our `TestObserver` to help us out with our test tasks.

Create `test_observer.rs` and give it this content:
```rust
// test_observer.rs 
use crate::mutex::{Mutex, RawMutex};
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

We will also need our ubiquitous `mutex.rs` that we've used in the previous examples.  Saavy readers may note that the need to copy these files between projects comes from the same lack of foresight that forced us to refactor the location of the dependencies also.  Perhaps these _anti-patterns_ exhibited here will inspire better code management design in your own projects.

```rust
// src/mutex.rs

#[cfg(test)]
pub use embassy_sync::blocking_mutex::raw::NoopRawMutex as RawMutex;

#[cfg(not(test))]
pub use embassy_sync::blocking_mutex::raw::ThreadModeRawMutex as RawMutex;

// Common export regardless of test or target
pub use embassy_sync::mutex::Mutex;
```

### Adding to `main.rs`
In previous examples, we made .rs files available for import by referencing them in `lib.rs`.  But here we are doing it differently.
Add the following to your `main.rs` file:
```rust
mod entry;
mod mutex;
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
use crate::mutex::{Mutex,RawMutex};
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

Let's set up our `entry.rs` to do that:
```rust
use embassy_executor::Spawner;
use static_cell::StaticCell;
use crate::mutex::{Mutex,RawMutex};
use crate::test_observer::{Observation, ObservationResult, register_observation, finalize_registry, all_seen, summary};
use crate::{duplicate_static_mut, observation_decl};
use embassy_time::{Timer, Duration};

use mock_battery::fuel_signal_ready::BatteryFuelReadySignal;
use mock_battery::mock_battery_device::MockBatteryDevice;

use battery_service::device::{Device as BatteryDevice, DeviceId as BatteryDeviceId};
use battery_service::wrapper::Wrapper;
use mock_battery::types::{BatteryChannel, OurController};
use embedded_services::power::policy::DeviceId;

static BATTERY: StaticCell<MockBatteryDevice> = StaticCell::new();
static BATTERY_FUEL: StaticCell<BatteryDevice> = StaticCell::new();
static BATTERY_EVENT_CHANNEL: StaticCell<BatteryChannel> = StaticCell::new();
static BATTERY_WRAPPER: StaticCell<
        Wrapper<'static, &'static mut OurController>
    > = StaticCell::new();
static CONTROLLER: StaticCell<OurController> = StaticCell::new();
static BATTERY_FUEL_READY: StaticCell<BatteryFuelReadySignal> = StaticCell::new();


#[embassy_executor::task]
pub async fn entry_task(spawner: Spawner) {
    println!("🚀 Starting battery + charger integration test");

    let obs_pass = observation_decl!(OBS_PASS, "Example Pass");
    finalize_registry();

    let battery = BATTERY.init(MockBatteryDevice::new(DeviceId(1)));
    let battery_mut = duplicate_static_mut!(battery, MockBatteryDevice);
    let battery_fuel = BATTERY_FUEL.init(BatteryDevice::new(BatteryDeviceId(1)));
    let controller = CONTROLLER.init(OurController::new(battery_mut.inner_battery()));
    let channel = BATTERY_EVENT_CHANNEL.init(BatteryChannel::new());
    let signal = BATTERY_FUEL_READY.init(BatteryFuelReadySignal::new());
    let wrapper = BATTERY_WRAPPER.init(Wrapper::new(battery_fuel, controller));

    // we don't use these (yet)
    let _ = wrapper;
    let _ = signal;
    let _ = channel; 

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

This test will run and report success but it will have allocated most of what we will need for upcoming test tasks,
so we are now in a good starting position.



