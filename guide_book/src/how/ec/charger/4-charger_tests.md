# Charger Unit Tests

We have all the pieces ready for our Charger component -- now let's write some unit tests to see it work in action and verify it is correct.

## Basic tests of virtual_charger.rs
Our first tests are just to verify the behavior of our virtual charger implementation.  This is simple, synchronous code and does not need any special handling in addition to the normal Rust `#[test]` support.

Open up `virtual_charger.rs` and at the bottom of the file
add these tests
```rust

// --------------

#[test]
fn initial_state() {
    let vcs = VirtualChargerState::new();
    let val = vcs.current();
    assert_eq!(val, 0);
    let val = vcs.voltage();
    assert_eq!(val, 0);
}
#[test]
fn setting_current_in_range() {
    let mut vcs = VirtualChargerState::new();
    let cur_set = 1234;
    let val = vcs.set_current(cur_set);
    assert_eq!(val, cur_set);
}
#[test]
fn setting_voltage_in_range() {
    let mut vcs = VirtualChargerState::new();
    let volt_set = 1234;
    let val = vcs.set_voltage(volt_set);
    assert_eq!(val, volt_set);
}
#[test]
fn setting_current_out_of_range() {
    let mut vcs = VirtualChargerState::new();
    let cur_set = 1234;
    let val = vcs.set_current(cur_set);
    assert_eq!(val, cur_set);
    let val = vcs.set_current(MAXIMUM_ALLOWED_CURRENT+1);
    assert_eq!(val, cur_set);
}
#[test]
fn setting_voltage_out_of_range() {
    let mut vcs = VirtualChargerState::new();
    let volt_set = 1234;
    let val = vcs.set_current(volt_set);
    assert_eq!(val, volt_set);
    let val = vcs.set_current(MAXIMUM_ALLOWED_VOLTAGE+1);
    assert_eq!(val, volt_set);
}
#[test]
fn setting_current_max() {
    let mut vcs = VirtualChargerState::new();
    let cur_set = MAXIMUM_ALLOWED_CURRENT;
    let val = vcs.set_voltage(cur_set);
    assert_eq!(val, cur_set);
}
#[test]
fn setting_voltage_max() {
    let mut vcs = VirtualChargerState::new();
    let volt_set = MAXIMUM_ALLOWED_VOLTAGE;
    let val = vcs.set_voltage(volt_set);
    assert_eq!(val, volt_set);
}
```

then run `cargo test -p mock_charger` and you should see

```
running 7 tests
test virtual_charger::initial_state ... ok
test virtual_charger::setting_voltage_in_range ... ok
test virtual_charger::setting_current_max ... ok
test virtual_charger::setting_current_in_range ... ok
test virtual_charger::setting_current_out_of_range ... ok
test virtual_charger::setting_voltage_out_of_range ... ok
test virtual_charger::setting_voltage_max ... ok

test result: ok. 7 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s
```

_note that tests may execute in different orders on any given run_

This set of tests shows us that our virtual battery maintains the values we set to it and that it respects
the MAXIMUM thresholds as intended.

For this example, we can skip unit tests for `mock_charger.rs` and `mock_charger_device.rs` because these are little more than wrappers that delegate ultimately to `virtual_charger.rs` anyway.  

Let's create some unit tests for the controller  Here we want to mimic the behavior it will experience in a system where a policy manager is directing it.

>### Return of `test_helper.rs`
>You may recall from the battery exercise that the asynchronous nature of much of the operation complicates the ability to use the normal test features of Rust, since it does not have a native async test support. 
For a review of what the `test_helper.rs` code does, please see [the discussion in the battery project](../battery/11a-test_helper.md)

Either copy `test_helper.rs` from the battery project, or add it new here, with this code:
```rust
// test_helper.rs

#[allow(unused_imports)]
use embassy_executor::{Executor, Spawner};
#[allow(unused_imports)]
use embassy_sync::signal::Signal;
#[allow(unused_imports)]
use static_cell::StaticCell;
#[allow(unused_imports)]
use crate::mutex::RawMutex; 

/// Helper macro to exit the process when all signals complete.
#[macro_export]
macro_rules! finish_test {
    () => {
        std::process::exit(0)
    };
}

/// Spawn a task that waits for all provided signals to fire, then exits.
#[cfg(test)]
pub fn join_signals<const N: usize>(
    spawner: &Spawner,
    signals: [&'static Signal<RawMutex, ()>; N],
) {
    let leaked: &'static [&'static Signal<RawMutex, ()>] = Box::leak(Box::new(signals));
    spawner.must_spawn(test_end(leaked));
}

/// Async task that waits for all signals to complete.
#[embassy_executor::task]
async fn test_end(signals: &'static [&'static Signal<RawMutex, ()>]) {
    for sig in signals.iter() {
        sig.wait().await;
    }
    finish_test!();
}
```

and add this to your `lib.rs`
```rust
pub mod mock_charger;
pub mod virtual_charger;
pub mod mutex;
pub mod mock_charger_device;
pub mod mock_charger_controller;
pub mod test_helper;
```

### Testing the MockChargerController
Open `mock_charger_controller.rs` and at the bottom, add this to establish the pattern for adding tests in our async helper framework:

```rust
// -------------------------------

#[cfg(test)]
use crate::test_helper::join_signals;
#[allow(unused_imports)]
use embassy_executor::Executor;
#[allow(unused_imports)]
use embassy_sync::signal::Signal;
#[allow(unused_imports)]
use static_cell::StaticCell;
#[allow(unused_imports)]
use crate::mutex::{Mutex, RawMutex};

#[test]
fn test_controller() {
    static EXECUTOR: StaticCell<Executor> = StaticCell::new();

    static EXM_DONE: StaticCell<Signal<RawMutex, ()>> = StaticCell::new();

    let executor = EXECUTOR.init(Executor::new());

    let example_done= EXM_DONE.init(Signal::new());

    executor.run(|spawner| {        
        spawner.must_spawn(example_test_task(example_done));

        join_signals(&spawner, [
            example_done,
        ]);
    });
}
#[embassy_executor::task]
async fn example_test_task(done:  &'static Signal<RawMutex, ()>) {
    assert_eq!(1+1, 2);
    done.signal(())
}
```
This test successfully does nothing much.  It's just to establish the pattern we will use when we add our actual test tasks.

This should pass when you run `cargo test -p mock_charger`

Now let's add additional tests.  These will actually test the controller.

We're going to follow the same pattern we used for the example task for the other test tasks.  We are also going to statically allocate a composed MockChargerController that we pass to each of the tasks.  Since we are passing this mutable borrow to more than one place, we run up against our multiple-borrow copy problem again.  And again, we'll use the `unsafe`-marked code that allows us to get around this to create as many 'unborrowed' copies as we need.  In this test code we won't bother migrating the macro for this, so the `unsafe` copy syntax is long form.  We'll test:

- `check_ready_acknowledged` -- to verify that the `controller.isReady()` method responds properly.
- `attach_handler_sets_values` -- to verify that when we attach the charger and specify values, these values are represented by the charger.
- `detach_handler_clears_values` -- to verify the complement - that detaching sets the values to 0.
- `attach_handler_rejects_invalid` -- to verify that trying to exceed the maximums will result in an error response at the Controller.

The full test code for this looks like:
```rust
// -------------------------------

#[cfg(test)]
use crate::test_helper::join_signals;
#[allow(unused_imports)]
use embassy_executor::Executor;
#[allow(unused_imports)]
use embassy_sync::signal::Signal;
#[allow(unused_imports)]
use static_cell::StaticCell;
#[allow(unused_imports)]
use crate::virtual_charger::VirtualChargerState;
#[allow(unused_imports)]
use embedded_services::power::policy::DeviceId;
#[allow(unused_imports)]
use crate::mutex::{Mutex, RawMutex};
#[allow(unused_imports)]
use crate::virtual_charger::{MAXIMUM_ALLOWED_CURRENT, MAXIMUM_ALLOWED_VOLTAGE};

#[test]
fn test_controller() {
    static EXECUTOR: StaticCell<Executor> = StaticCell::new();

    static DEVICE: StaticCell<MockChargerDevice> = StaticCell::new();
    static CONTROLLER: StaticCell<MockChargerController> = StaticCell::new();

    static EXM_DONE: StaticCell<Signal<RawMutex, ()>> = StaticCell::new();
    static CRA_DONE:  StaticCell<Signal<RawMutex, ()>> = StaticCell::new();
    static AHSV_DONE: StaticCell<Signal<RawMutex, ()>> = StaticCell::new();
    static DHCV_DONE: StaticCell<Signal<RawMutex, ()>> = StaticCell::new();
    static AHRI_DONE: StaticCell<Signal<RawMutex, ()>> = StaticCell::new();


    let executor = EXECUTOR.init(Executor::new());

    let example_done= EXM_DONE.init(Signal::new());
    let cra_done = CRA_DONE.init(Signal::new());
    let ahsv_done = AHSV_DONE.init(Signal::new());
    let dhcv_done = DHCV_DONE.init(Signal::new());
    let ahri_done = AHRI_DONE.init(Signal::new());

    executor.run(|spawner| {        
        let device = DEVICE.init(MockChargerDevice::new(DeviceId(1)));
        let controller = CONTROLLER.init(MockChargerController::new(device));
        // SAFETY: Must use the unsafe-marked copy pattern to avoid multiple borrow violation
        let controller1 = unsafe { &mut *(controller as *const MockChargerController<'static> as *mut MockChargerController<'static>) };
        let controller2 = unsafe { &mut *(controller as *const MockChargerController<'static> as *mut MockChargerController<'static>) };
        let controller3 = unsafe { &mut *(controller as *const MockChargerController<'static> as *mut MockChargerController<'static>) };
        let controller4 = unsafe { &mut *(controller as *const MockChargerController<'static> as *mut MockChargerController<'static>) };
        spawner.must_spawn(example_test_task(example_done));
        spawner.must_spawn(check_ready_acknowledged(controller1, cra_done));
        spawner.must_spawn(attach_handler_sets_values(controller2, ahsv_done));
        spawner.must_spawn(detach_handler_clears_values(controller3, dhcv_done));
        spawner.must_spawn(attach_handler_rejects_invalid(controller4, ahri_done));

        join_signals(&spawner, [
            example_done,
            cra_done,
            ahsv_done,
            dhcv_done,
            ahri_done
        ]);
    });
}
#[embassy_executor::task]
async fn example_test_task(done:  &'static Signal<RawMutex, ()>) {
    assert_eq!(1+1, 2);
    done.signal(())
}

#[embassy_executor::task]
async fn check_ready_acknowledged(controller: &'static mut MockChargerController<'static>,  done: &'static Signal<RawMutex, ()>) {
    let result = controller.is_ready().await;
    assert!(result.is_ok());

    done.signal(());
}

#[embassy_executor::task]
async fn attach_handler_sets_values(controller: &'static mut MockChargerController<'static>,  done: &'static Signal<RawMutex, ()>) {

    let cap = PowerCapability {
        voltage_mv: 5000,
        current_ma: 1000,
    };

    let result = controller.attach_handler(cap).await;
    assert!(result.is_ok());

    done.signal(());
}
#[embassy_executor::task]
async fn detach_handler_clears_values(controller: &'static mut MockChargerController<'static>, done: &'static Signal<RawMutex, ()>) {
    // Attach first
    let cap = PowerCapability {
        voltage_mv: 5000,
        current_ma: 1000,
    };
    controller.attach_handler(cap).await.unwrap();

    // Now detach
    controller.detach_handler().await.unwrap();

    let inner = controller.device.inner_charger();
    let state = inner.state.lock().await;
    assert_eq!(state.voltage(), 0);
    assert_eq!(state.current(), 0);

    done.signal(());
}
#[embassy_executor::task]
async fn attach_handler_rejects_invalid(controller: &'static mut MockChargerController<'static>, done: &'static Signal<RawMutex, ()>) {
    let cap = PowerCapability {
        voltage_mv: MAXIMUM_ALLOWED_VOLTAGE + 1,
        current_ma: MAXIMUM_ALLOWED_CURRENT + 1,
    };

    let result = controller.attach_handler(cap).await;
    assert!(matches!(result, Err(ChargerError::InvalidState(_))));

    done.signal(());
}
```

If you feel motivated, there are other test tasks you could write as well:

- __Attach/Detach sequence consistency__: Attach with valid values, then detach, then attach again — confirm that the values are re-applied correctly and the state is updated between each.

- __Initialization + CheckReady sequence is idempotent__: Call `is_ready()` and `init_charger()` multiple times and ensure they always return Ok(()) without state drift or error.

-  __wait_event emits expected event__: This could simulate listening for ChargerEvent::Initialized and asserting its value.

You might add support for simulated event dispatch or hook in a mock event queue (even if the current implementation hardcodes Initialized).

