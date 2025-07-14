# Charger Unit Tests

Just like we did for our `MockBattery`, we will want to have unit tests for our `MockCharger`, too.

Although the behavior of our charger is simple, we still validate its correctness with a small set of focused unit tests that exercise both the `MockCharger` logic an its interaction with the underlying `VirtualChargerState`.

> ### No trivial code
> It may seem unnecessary to test very simple constructs like this, _after all, it's just setting a state_.
> But it is important to test _all_ code, for many reasons, but particularly for these data-level constructs, because:
> - They are easily overlooked if there is a refactor.
> - They may easily be errantly modified
> - If the underlying data comes from hardware, there is more technical code involved that must be tested
>
> Portability of the code layers relies upon validation testing for each step.  Modular portability is a key principle of ODP, and
can only be honored with complete test coverage at all levels.

### Unit tests for MockCharger

The unit tests for `MockCharger` should be added at the bottom of `mock_charger.rs`.  These tests will use the same async execution pattern and test_helper imports we used before in `mock_battery.rs`, so start out your test section in `mock_charger.rs` like this:
```rust
// ----------------------------
#[cfg(test)]
use crate::test_helper::join_signals;
#[allow(unused_imports)]
use embassy_executor::Executor;
#[allow(unused_imports)]
use embassy_sync::signal::Signal;
#[allow(unused_imports)]
use static_cell::StaticCell;
```

### Behavior of the setter methods
The `Charger` interface has only two methods `charging_current` and `charging_voltage`.  Both of these are setters that echo back what was set.  In our `MockCharger` implementation, these values are also commuted down to the `VirtualChargerState` level, so we want to verify that this is working as expected too.

Create this test and tasks:

```rust
#[test]
fn test_charger_settings() {
    static EXECUTOR: StaticCell<Executor> = StaticCell::new();

    static CUR_ECHO_DONE: StaticCell<Signal<RawMutex, ()>> = StaticCell::new();
    static VOLT_ECHO_DONE: StaticCell<Signal<RawMutex, ()>> = StaticCell::new();

    let executor = EXECUTOR.init(Executor::new());

    let cur_echo_done= CUR_ECHO_DONE.init(Signal::new());    
    let volt_echo_done= VOLT_ECHO_DONE.init(Signal::new());    

    executor.run(|spawner| {        
        spawner.must_spawn(current_echo_test_task(cur_echo_done));
        spawner.must_spawn(voltage_echo_test_task(volt_echo_done));

        join_signals(&spawner, [
                cur_echo_done, 
                volt_echo_done,
        ]);
    });
    
}

// Test that the value passed to the setter is echoed back 
// and that it is commuted to the inner state.
#[embassy_executor::task]
async fn current_echo_test_task(done:  &'static Signal<RawMutex, ()>) {
    let mut charger = MockCharger::new();
    let state = charger.state.clone();
    let echo = charger.charging_current(1234).await.unwrap();
    assert_eq!(echo, 1234);
    let lock = state.lock().await;
    assert_eq!(lock.current(), echo);
    done.signal(());
}
// Test that the value passed to the setter is echoed back 
// and that it is commuted to the inner state.
#[embassy_executor::task]
async fn voltage_echo_test_task(done:  &'static Signal<RawMutex, ()>) {
    let mut charger = MockCharger::new();
    let state = charger.state.clone();
    let echo = charger.charging_current(1234).await.unwrap();
    assert_eq!(echo, 1234);
    let lock = state.lock().await;
    assert_eq!(lock.current(), echo);
    done.signal(());
}
```
This will verify that setting these values will return the value set, and that this value is also commuted to the underlying `VirtualChargerState`.

Run `cargo test -p mock_battery` and verify there are no failures in these tasks.

### Rejection of out-of-range values
Our `MockCharger` implementation exhibits a feature of its own - an attempt to set a value that is out of range for current or voltage levels is not accepted, and no change in the underlying setting is made.  We want to test for this feature as well.

Since this is still part of testing the _setting_ behavior, we'll make these tests additional tasks for our existing `test_charger_settings()` test.

Let's start by creating those tasks:
```rust
// Test that setting a value above max does not change the previously set value
#[embassy_executor::task]
async fn current_max_test_task(done:  &'static Signal<RawMutex, ()>) {
    let mut charger = MockCharger::new();
    let state = charger.state.clone();
    let echo = charger.charging_current(1234).await.unwrap();
    assert_eq!(echo, 1234);
    {
        let lock = state.lock().await;
        assert_eq!(lock.current(), echo);
    }
    // // now set an illegal value
    let over_max = MAXIMUM_ALLOWED_CURRENT + 1000;
    let max_echo = charger.charging_current(over_max).await.unwrap();
    assert_ne!(max_echo, over_max); // should not have set it 
    assert_eq!(max_echo, echo); // should be the previously set value
    {
        let lock = state.lock().await;
        assert_eq!(lock.current(), echo); // previous state should not have changed either.
    }

    done.signal(());
}
// Test that setting a value above max does not change the previously set value
#[embassy_executor::task]
async fn voltage_max_test_task(done:  &'static Signal<RawMutex, ()>) {
    let mut charger = MockCharger::new();
    let state = charger.state.clone();
    let echo = charger.charging_voltage(1234).await.unwrap();
    assert_eq!(echo, 1234);
    {
        let lock = state.lock().await;
        assert_eq!(lock.voltage(), echo);
    }
    // now set an illegal value
    let over_max = MAXIMUM_ALLOWED_VOLTAGE+1000;
    let max_echo = charger.charging_voltage(over_max).await.unwrap();
    assert_ne!(max_echo, over_max); // should not have set it 
    assert_eq!(max_echo, echo); // should be the previously set value
    {
        let lock = state.lock().await;
        assert_eq!(lock.voltage(), echo); // previous state should not have changed either.
    }

    done.signal(());
}
```

We'll need to add the static allocators for the DONE signals we will need in our `test_charger_settings()` test:
```rust
    static CUR_MAX_DONE: StaticCell<Signal<RawMutex, ()>> = StaticCell::new();
    static VOLT_MAX_DONE: StaticCell<Signal<RawMutex, ()>> = StaticCell::new();
```
and the corresponding init values for those:
```rust
    let cur_max_done = CUR_MAX_DONE.init(Signal::new());
    let volt_max_done = VOLT_MAX_DONE.init(Signal::new());
```
and then our spawning and joining section can look like:
```rust
        spawner.must_spawn(current_echo_test_task(cur_echo_done));
        spawner.must_spawn(voltage_echo_test_task(volt_echo_done));
        spawner.must_spawn(current_max_test_task(cur_max_done));
        spawner.must_spawn(voltage_max_test_task(volt_max_done));

        join_signals(&spawner, [
                cur_echo_done, 
                volt_echo_done,
                cur_max_done, 
                volt_max_done
        ]);
```

As you can see, the tests for exceeding max current and max voltage are much the same as one another.  Each starts out similar to the echo tests, but then goes further to attempt an illegal over-maximum value set, which should have no effect on the underlying value.

Run `cargo test -p mock_battery` to insure all is well.

Now we are ready to move on to actual integration testing for battery and charger together.




