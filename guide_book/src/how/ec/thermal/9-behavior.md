# Thermal Component Behavior
Speaking of implementing behavior, let's turn our attention to that now. The behavior of the thermal subsystem is defined by how it interacts with the mock sensor and fan components, and how it responds to temperature readings and thresholds.

## Sensor Behavior
We will add some code to the `MockSensorController` to simulate temperature readings and threshold evaluations.

First off, let's define a simple enum to represent the threshold events that we will be monitoring:
```rust
/// Events to announce thermal threshold crossings
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ThresholdEvent {
    None,
    OverHigh,
    UnderLow
}
```
Which of these events is triggered will depend on the temperature readings and the thresholds that we set.
We will also need to keep track of whether we have already triggered an event for a given threshold, to avoid spamming the event stream with repeated events.

In the `MockSensor` implementation, we will add a method to evaluate the thresholds based on the current temperature:
```rust
    // Check if temperature has exceeded the high/low thresholds and 
    // issue an event if so.  Protect against hysteresis.
    const HYST: f32 = 0.5;
    pub fn eval_thresholds(&mut self, t:f32, lo:f32, hi:f32,
        hi_latched: &mut bool, lo_latched: &mut bool) -> ThresholdEvent {

        // trip rules: >= hi and <= lo (choose your exact policy)
        if t >= hi && !*hi_latched {
            *hi_latched = true;
            *lo_latched = false;
            return ThresholdEvent::OverHigh;
        }
        if t <= lo && !*lo_latched {
            *lo_latched = true;
            *hi_latched = false;
            return ThresholdEvent::UnderLow;
        }
        // clear latches only after re-entering band with hysteresis
        if t < hi - Self::HYST { *hi_latched = false; }
        if t > lo + Self::HYST { *lo_latched = false; }
        ThresholdEvent::None            
    }
```

## Fan Behavior
Somewhere in the thermal subsystem, there must exist the logic for cooling the system when the temperature exceeds a certain threshold. This is typically done by spinning up a fan to increase airflow and reduce the temperature. This logic is usually implemented in the fan controller, which will monitor the temperature readings and adjust the fan speed accordingly.

we will start by defining the events that signal the need to cool, or when to back off on cooling, by adding these definitions in `mock_fan_controller.rs`:

```rust
/// Request to increase or decrease cooling efforts
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CoolingRequest { 
    Increase, 
    Decrease 
}

/// Resulting values to apply to accommodate request
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct CoolingResult {
    pub new_level: u8,
    pub target_rpm_percent: u8,
    pub spinup: Option<SpinUp>,
}
```
We also want to define a "policy" for how to handle these requests, which will be defined in a `FanPolicy` struct. This policy will define a set of configurable values that will be used to determine how to respond to the cooling requests. We will include a simple default policy that will be used to determine how to handle the cooling requests.

```rust
/// Policy Configuration values for behavior logic
#[derive(Debug, Clone, Copy)]
pub struct FanPolicy {
    /// Max discrete cooling level (e.g., 10 means levels 0..=10).
    pub max_level: u8,
    /// Step per Increase/Decrease (in “levels”).
    pub step: u8,
    /// If going 0 -> >0, kick the fan to at least this RPM briefly.
    pub min_start_rpm: u16,
    /// The level you jump to on the first Increase from 0.
    pub start_boost_level: u8,
    /// How long to hold the spin-up RPM before dropping to level RPM.
    pub spinup_hold_ms: u32,
}

impl Default for FanPolicy {
    fn default() -> Self {
        Self {
            max_level: 10,
            step: 2,
            min_start_rpm: 1200,
            start_boost_level: 3,
            spinup_hold_ms: 300,
        }
    }
}

/// One-shot spin-up hint: force RPM for a short time so the fan actually starts.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SpinUp {
    pub rpm: u16,
    pub hold_ms: u32,
}
```
The `SpinUp` struct is used to indicate that the fan should be spun up to a specific RPM for a certain amount of time before settling into the normal operating RPM. This is useful for ensuring that the fan starts properly from a stopped state, as some fans require a minimum RPM to start spinning.

We can also use some utility functions to help us determine the new fan speed based on the current level and the policy:
```rust
/// Linear mapping helper: level (0..=max) → PWM % (0..=100).
#[inline]
pub fn level_to_pwm(level: u8, max_level: u8) -> u8 {
    if max_level == 0 { return 0; }
    ((level as u16 * 100) / (max_level as u16)) as u8
}

/// Percentage mapping helper: pick a percentage of the range
#[inline]
pub fn percent_to_rpm_range(min: u16, max: u16, percent: u8) -> u16 {
    let p = percent.min(100) as u32;
    let span = (max - min) as u32;
    min + (span * p / 100) as u16
}
/// Percentage mapping helper: pick a percentage of the max
#[inline]
pub fn percent_to_rpm_max(max: u16, percent: u8) -> u16 {
    (max as u32 * percent.min(100) as u32 / 100) as u16
}
```
Finally, we come to our core policy logic.  This handles transitioning the fan speed based on the current cooling level and the requested action, per the policy configuration it is given. It will also determine if a spin-up is needed based on the current state of the fan.

```rust
/// Core policy: pure, no I/O. Call this from your controller when you receive a cooling request.
/// Later, if `spinup` is Some, briefly force RPM, then set RPM to `target_rpm_percent`.
pub fn apply_cooling_request(cur_level: u8, req: CoolingRequest, policy: &FanPolicy) -> CoolingResult {
    // Sanitize policy
    let max = policy.max_level.max(1);
    let step = policy.step.max(1);
    let boost = policy.start_boost_level.clamp(1, max);

    let mut new_level = cur_level.min(max);
    let mut spinup = None;

    match req {
        CoolingRequest::Increase => {
            if new_level == 0 {
                new_level = boost;
                spinup = Some(SpinUp { rpm: policy.min_start_rpm, hold_ms: policy.spinup_hold_ms });
            } else {
                new_level = new_level.saturating_add(step).min(max);
            }
        }
        CoolingRequest::Decrease => {
            new_level = new_level.saturating_sub(step);
        }
    }

    CoolingResult {
        new_level,
        target_rpm_percent: level_to_pwm(new_level, max),
        spinup,
    }
}
```
Now, for the Controller to handle these requests, we will add a member function to the `MockFanController` that can be called in response to a CoolingRequest.

In the `impl MockFanController` block, we will add the following method:
```rust
    /// Execute behavior policy for a cooling request
    pub async fn handle_request(
        &mut self,
        cur_level: u8,
        req: CoolingRequest,
        policy: &FanPolicy,
    ) -> Result<(CoolingResult, u16), MockFanError> {
        let res = apply_cooling_request(cur_level, req, policy);
        if let Some(sp) = res.spinup {
            // 1) force RPM to kick the rotor
            let _ = self.set_speed_rpm(sp.rpm).await?;
            // 2) hold for `sp.hold_ms` with embassy_time to allow spin up first
            embassy_time::Timer::after(embassy_time::Duration::from_millis(sp.hold_ms as u64)).await;
        }
        let pwm = level_to_pwm(res.new_level, policy.max_level);
        let rpm = self.set_speed_percent(pwm).await?;
        Ok((res, rpm))
    }
```


So now we have a complete implementation of the thermal component behavior, which includes:
- Evaluating temperature thresholds in the sensor.      
- Responding to cooling requests in the fan controller.

This allows us to simulate the behavior of a thermal subsystem that can monitor temperature and adjust cooling efforts accordingly.

Next, let's write some unit tests to verify that this behavior works as expected.