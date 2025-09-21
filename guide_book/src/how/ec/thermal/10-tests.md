# Thermal Unit Tests
Up to this point, we've been implementing according to the patterns we've established in previous examples, but we haven't yet tried to run anything to verify that it works. Now we will add some unit tests to verify that our mock thermal component behaves as expected.

We will write unit tests for both the MockSensorController and the MockFanController. These tests will cover the basic functionality of each component, ensuring that they respond correctly to temperature readings and cooling requests, and will also verify that the behavior policies are applied correctly.

We do not have a comms system in place yet, so we will not be able to test the full service integration, but we can still verify that the components behave correctly in isolation.  We will cover the integration testing in a later section.

## Mock Sensor Controller Tests
Let's start with the MockSensorController. Open the file `src/mock_sensor_controller.rs` and add the following tests at the end of the file:

```rust
// --------------------
#[cfg(test)]
use ec_common::test_helper::join_signals;
#[allow(unused_imports)]
use embassy_executor::Executor;
#[allow(unused_imports)]
use embassy_sync::signal::Signal;
#[allow(unused_imports)]
use static_cell::StaticCell;
#[allow(unused_imports)]
use embedded_services::power::policy::DeviceId;
#[allow(unused_imports)]
use ec_common::mutex::{Mutex, RawMutex};

// Tests that don't need async
#[test]
fn threshold_crossings_and_hysteresis() {
    // Build a controller with a default sensor
    static DEVICE: StaticCell<MockSensorDevice> = StaticCell::new();
    static CONTROLLER: StaticCell<MockSensorController> = StaticCell::new();
    let device = DEVICE.init(MockSensorDevice::new(DeviceId(1)));
    let controller = CONTROLLER.init(MockSensorController::new(device));
    let mut hi_lat = false;
    let mut lo_lat = false;

    // Program thresholds via helpers or direct fields for tests
    let (lo, hi) = (45.0_f32, 50.0_f32);

    // Script: (t, expect)
    use crate::mock_sensor_controller::ThresholdEvent::*;
    let steps = [
        (49.9, None),
        (50.1, OverHigh),
        (49.8, None),                 // still latched above-hi, no duplicate
        (49.3, None),                 // cross below hi - hyst clears latch
        (44.9, UnderLow),
        (45.3, None),                 // cross above low + hyst clears latch
    ];

    for (t, want) in steps {
        let got = controller.eval_thresholds(t, lo, hi, &mut hi_lat, &mut lo_lat);
        assert_eq!(got, want, "t={t}°C");
    }
}

// Tests that need async tasks --
#[test]
fn test_controller() {
    static EXECUTOR: StaticCell<Executor> = StaticCell::new();

    static DEVICE: StaticCell<MockSensorDevice> = StaticCell::new();
    static CONTROLLER: StaticCell<MockSensorController> = StaticCell::new();

    static TSV_DONE: StaticCell<Signal<RawMutex, ()>> = StaticCell::new();

    let executor = EXECUTOR.init(Executor::new());

    let tsv_done = TSV_DONE.init(Signal::new());

    executor.run(|spawner| {        
        let device = DEVICE.init(MockSensorDevice::new(DeviceId(1)));
        let controller = CONTROLLER.init(MockSensorController::new(device));

        let _ = spawner.spawn(test_setting_values(controller, tsv_done));
 
        join_signals(&spawner, [
            tsv_done
        ]);
    });
}

// check initial state, then
// set temperature, thresholds low and high, check sync with the underlying state
#[embassy_executor::task]
async fn test_setting_values(
    mut controller: &'static mut MockSensorController,
    done: &'static Signal<RawMutex, ()>
) 
{
    // verify initial state
    assert_eq!(0.0, controller.sensor.get_temperature());
    assert_eq!(f32::NEG_INFINITY, controller.sensor.get_threshold_low());
    assert_eq!(f32::INFINITY, controller.sensor.get_threshold_high());

    let temp = 12.34;
    let low = -56.78;
    let hi = 67.89;
    controller.sensor.set_temperature(temp);
    let _ = controller.set_temperature_threshold_low(low).await;
    let _ = controller.set_temperature_threshold_high(hi).await;
    let rtemp = controller.temperature().await.unwrap();
    assert_eq!(rtemp, temp);
    assert_eq!(controller.sensor.get_threshold_low(), low);
    assert_eq!(controller.sensor.get_threshold_high(), hi);

    done.signal(());
}
```
This code defines a couple of tests for the `MockSensorController`. The first test, `threshold_crossings_and_hysteresis`, checks that the threshold evaluation logic works correctly, including hysteresis behavior. The second test, `test_controller`, initializes the controller and tests setting temperature and thresholds, verifying that the values are correctly synchronized with the underlying sensor state. Since we are using async tasks, we need to use the `embassy_executor` crate to run the tests in an async context. We've seen this pattern before, so it should be familiar.

Run these tests using `cargo test -p mock_thermal` to verify that the `MockSensorController` behaves as expected.

## Mock Fan Controller Tests
Next, let's add tests for the `MockFanController`. Open the file `src/mock_fan_controller.rs` and add the following tests at the end of the file:

```rust 
// --------------------
#[cfg(test)]
use ec_common::test_helper::join_signals;
#[allow(unused_imports)]
use embassy_executor::Executor;
#[allow(unused_imports)]
use embassy_sync::signal::Signal;
#[allow(unused_imports)]
use static_cell::StaticCell;
#[allow(unused_imports)]
use embedded_services::power::policy::DeviceId;
#[allow(unused_imports)]
use ec_common::mutex::{Mutex, RawMutex};

// Tests that don't need async
#[test]
fn increase_from_zero_triggers_spinup_then_levels() {
    let p = FanPolicy { min_start_rpm: 1000, spinup_hold_ms: 250, ..FanPolicy::default() };
    let r1 = apply_cooling_request(0, CoolingRequest::Increase, &p);
    assert_eq!(r1.new_level, 3);
    assert_eq!(r1.target_rpm_percent, 30);
    assert_eq!(r1.spinup, Some(SpinUp { rpm: 1000, hold_ms: 250 }));

    // Next increase: no spinup, just step
    let r2 = apply_cooling_request(r1.new_level, CoolingRequest::Increase, &p);
    assert_eq!(r2.new_level, 5);
    assert_eq!(r2.spinup, None);
}

#[test]
fn saturates_at_bounds_and_is_idempotent_at_extremes() {
    let p = FanPolicy::default();

    // Clamp at max
    let r = apply_cooling_request(10, CoolingRequest::Increase, &p);
    assert_eq!(r.new_level, 10);
    assert_eq!(r.spinup, None);

    // Clamp at 0
    let r = apply_cooling_request(1, CoolingRequest::Decrease, &p);
    assert_eq!(r.new_level, 0);
    let r = apply_cooling_request(0, CoolingRequest::Decrease, &p);
    assert_eq!(r.new_level, 0);
}

#[test]
fn mapping_to_rpm_is_linear_and_total() {
    assert_eq!(level_to_pwm(0, 10), 0);
    assert_eq!(level_to_pwm(5, 10), 50);
    assert_eq!(level_to_pwm(10, 10), 100);
}

// Tests that need async tasks --
#[test]
fn test_setting_values() {
    static EXECUTOR: StaticCell<Executor> = StaticCell::new();
    static DEVICE: StaticCell<MockFanDevice> = StaticCell::new();
    static CONTROLLER: StaticCell<MockFanController> = StaticCell::new();
    static DONE: StaticCell<Signal<RawMutex, ()>> = StaticCell::new();

    let executor = EXECUTOR.init(Executor::new());
    let done = DONE.init(Signal::new());

    executor.run(|spawner| {       
        let device = DEVICE.init(MockFanDevice::new(DeviceId(1)));
        let controller = CONTROLLER.init(MockFanController::new(device));

        // run these tasks sequentially
        let _ = spawner.spawn(setting_values_test_task(controller, done));
        join_signals(&spawner, [done]);
    });
}
#[test]
fn test_handle_request() {
    static EXECUTOR: StaticCell<Executor> = StaticCell::new();
    static DEVICE: StaticCell<MockFanDevice> = StaticCell::new();
    static CONTROLLER: StaticCell<MockFanController> = StaticCell::new();
    static DONE: StaticCell<Signal<RawMutex, ()>> = StaticCell::new();

    let executor = EXECUTOR.init(Executor::new());
    let done = DONE.init(Signal::new());

    executor.run(|spawner| {       
        let device = DEVICE.init(MockFanDevice::new(DeviceId(1)));
        let controller = CONTROLLER.init(MockFanController::new(device));

        // run these tasks sequentially
        let _ = spawner.spawn(handle_request_test_task(controller, done));
        join_signals(&spawner, [done]);
    });
}

// check initial state, then
// set temperature, thresholds low and high, check sync with the underlying state
#[embassy_executor::task]
async fn setting_values_test_task(
    controller: &'static mut MockFanController,
    done: &'static Signal<RawMutex, ()>
) 
{
    use crate::virtual_fan::{FAN_RPM_MINIMUM, FAN_RPM_MAXIMUM, FAN_RPM_START};
    // verify initial state
    let rpm = controller.rpm().await.unwrap();
    let min = controller.min_rpm();
    let max = controller.max_rpm();
    let min_start = controller.min_start_rpm();
    assert_eq!(rpm, 0);
    assert_eq!(min, FAN_RPM_MINIMUM);
    assert_eq!(max, FAN_RPM_MAXIMUM);
    assert_eq!(min_start, FAN_RPM_START);

    // now set values and verify them
    let _ = controller.set_speed_max().await;
    let v = controller.rpm().await.unwrap();
    assert_eq!(v, FAN_RPM_MAXIMUM);
    let _ = controller.set_speed_percent(50).await;
    let v = controller.rpm().await.unwrap();
    assert_eq!(v, FAN_RPM_MAXIMUM / 2);
    let _ = controller.set_speed_rpm(0).await;
    let v = controller.rpm().await.unwrap();
    assert_eq!(v, 0);

    done.signal(());
}

#[embassy_executor::task]
async fn handle_request_test_task(
    controller: &'static mut MockFanController,
    done: &'static Signal<RawMutex, ()>
) {
    let policy = FanPolicy { min_start_rpm: 1000, spinup_hold_ms: 0, ..Default::default() };

    // Start from 0, request Increase -> expect spinup and final RPM for boost level
    let (res1, rpm1) = controller.handle_request(0, CoolingRequest::Increase, &policy).await.unwrap();
    assert!(res1.spinup.is_some(), "should spin up from 0");
    assert_eq!(res1.new_level, policy.start_boost_level);

    // Final RPM should match the percent mapping for the new level
    let expect1 = percent_to_rpm_max(controller.max_rpm(), level_to_pwm(res1.new_level, policy.max_level));
    assert_eq!(rpm1, expect1);

    // Next increase -> no spinup; just step up by `step`
    let (res2, rpm2) = controller.handle_request(res1.new_level, CoolingRequest::Increase, &policy).await.unwrap();
    assert!(res2.spinup.is_none());
    assert_eq!(res2.new_level, (res1.new_level + policy.step).min(policy.max_level));

    let expect2 = percent_to_rpm_max(controller.max_rpm(), level_to_pwm(res2.new_level, policy.max_level));
    assert_eq!(rpm2, expect2);

    done.signal(());    
}
```
The first test, `increase_from_zero_triggers_spinup_then_levels`, checks that the fan controller correctly handles an increase request from zero, triggering a spin-up and then setting the fan speed to the appropriate level. The second test, `saturates_at_bounds_and_is_idempotent_at_extremes`, verifies that the fan controller correctly saturates at the maximum and minimum levels and that repeated requests do not change the state.
The third test, `mapping_to_rpm_is_linear_and_total`, checks that the level-to-PWM mapping is linear and that it correctly maps levels to RPM percentages.      

The last two tests, `test_setting_values` and `test_handle_request`, are async tasks that test setting the fan speed and handling cooling requests, respectively. They ensure that the fan controller behaves correctly when interacting with the underlying mock fan device.

Run these tests using `cargo test -p mock_thermal` to verify that the `MockFanController` behaves as expected.

## Conclusion
With these unit tests in place, we have a solid foundation for verifying the behavior of our mock thermal component. These tests cover the basic functionality of both the sensor and fan controllers, ensuring that they respond correctly to temperature readings and cooling requests.

At this point we have created mock representations of an embedded battery and charger, and now a thermal component with a sensor and fan. We have also implemented the necessary traits and controllers to interact with these components.
Next, we will look at how to integrate these components into a service and prepare them for use in an embedded system. This will involve creating a service layer that can manage the thermal component and its interactions with the rest of the system, allowing us to test the full functionality of the thermal subsystem in a simulated environment.
This will be similar to what we have done previously for the battery and charger components, but with some additional considerations for the thermal component's behavior and interactions.
We will also explore how to write integration tests to verify that the thermal component works correctly when integrated with the rest of the system. This will involve simulating the behavior of the thermal component in a more realistic environment, allowing us to test its interactions with other components and services.