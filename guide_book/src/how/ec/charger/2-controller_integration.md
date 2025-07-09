# Controller Integration

Now that our battery device is properly equipped with a `Charger` interface, we can complete the integration at the `Controller`.

## How the Controller handles charging

The `Controller` must manage the charging needs of the battery by:
1. Detecting when the battery requires charging
2. Instructing the carger to apply current and voltage, or to stop charging

The `SmartBattery` interface defines for us some traits in this regard
- `remaining_capacity()`
- `relative_state_of_charge()`
- `battery_status()`
- `voltage()` and `current()`

and the `Charger` interface gives us:
- `current()` and `voltage()` as the values the charger will supply when enabled.
- `enable()` and `disable()` to turn the charger on and off.

We will create a simplistic rule for the `Controller` to adhere to when administering the charger:
"If the battery state of charge falls below 90%, then enable the charger at a constant rate, and disable the
charger if the state of charge is 90% or higher".
This is an overly-simplistic rule to be an efficient scheme in a real-life battery scenario, but it is good enough for our virtual battery simulation.

Later, when we integrate Thermal awareness into the scheme, the rate of charge and the enable/disable decisions will be affected
by conditions made known through Thermal event notifications.  But for now, this will do.

### Adding the poll_and_manage trait to the Controller
To perform this logic, the `Controller` needs a method that can be called by an executive task on a periodic basis - say once per second - to determine its actions.  This is not a trait to implement - it is business logic we add to the controller implementation ourselves to fit our needs.

Edit the `mock_battery_controller.rs` file and add these lines near the top:
```rust
use embedded_batteries_async::charger::Charger;

const APPLIED_CHARGER_CURRENT:u16 = 1500;  // milliamps
const APPLIED_CHARGER_VOLTAGE:u16 = 12600; // millivolts
const THRESHOLD_CHARGE_PERCENT: u8 = 90; // percent of remaining charge boundary to turn charger on/off
```

then, we need to update the controller to be aware of the injected charger as well as battery, 
so change the declaration that currently reads as:
```rust
pub struct MockBatteryController<B: SmartBattery + Send> {
    /// The underlying battery instance that this controller manages.
    battery: B,
}
```
to
```rust
pub struct MockBatteryController<B: SmartBattery + Send, C:Charger + Send> {
    /// The underlying battery instance that this controller manages.
    battery: B,
    charger: C,
}
```

and we will both update the `impl` block and add our new method for charging decisions by replacing the `impl` block with:

```rust
impl<B, C> MockBatteryController<B, C>
where
    B: SmartBattery + Send,
    C: Charger + Send,
{
    pub fn new(battery: B, charger: C) -> Self {
        Self { battery, charger }
    }
    pub async fn poll_and_manage(&mut self) -> Result<(), <Self as ErrorType>::Error> {
        let soc = self.battery.relative_state_of_charge().await.unwrap();

        if soc < THRESHOLD_CHARGE_PERCENT {
        let _ = self.charger.charging_current(APPLIED_CHARGER_CURRENT).await;
        let _ = self.charger.charging_voltage(APPLIED_CHARGER_VOLTAGE).await;
        } else {
            let _ = self.charger.charging_current(0).await;
            let _ = self.charger.charging_voltage(0).await;
        }
        Ok(())
    }
}
```
This introduces our `poll_and_manage()` method that will apply charge or not according to our rules.

We must now continue to update our generic template decorations to account for the new Charger in other places where this is used.

change the block that reads
```rust
impl <B> ErrorType for MockBatteryController<B>
where
    B: SmartBattery + Send
```
to now include the `Charger`: 
```rust
impl<B, C> ErrorType for MockBatteryController<B, C>
where
    B: SmartBattery + Send,
    C: Charger + Send
```
and similarly for the `SmartBattery` `impl`:
```rust
impl<B, C> SmartBattery for &mut MockBatteryController<B, C>
where
    B: SmartBattery + Send,
    C: Charger + Send
```
and for the `Controller` `impl`:
```rust
impl<B, C> Controller for &mut MockBatteryController<B, C>
where
    B: SmartBattery + Send,
    C: Charger + Send
```

Finally, before we are done with the `Controller`, we need to make a change in our implementation of `get_dynamic_data()` to read the charging voltage and current from the attached `Charger` rather than our virtual battery by updating to these lines:
```rust
        let charging_voltage_mv = self.charger.charging_voltage(APPLIED_CHARGER_VOLTAGE).await.unwrap();
        let charging_current_ma = self.charger.charging_current(APPLIED_CHARGER_CURRENT).await.unwrap();
```
Although it is not necessary, you _could_ remove these values from `virtual_battery.rs` now, because we won't be using them anymore.

Now, over in our `main.rs` file, we need to update our references to the `MockBatteryController` with this new generic injection parameter for the `Charger`.

Open `main.rs` and search for all occurrences of `MockBatteryController<&'static mut MockBattery>`, which designates our battery injection and replace with `MockBatteryController<&'static mut MockBattery, &'static mut MockCharger>`, which specifies both the battery and charger.

and up near the top, add 
```rust
use mock_battery::mock_charger::MockCharger;
```

In the function `main()`, we need to include our `inner_charger` from the device to the constructor of the controller in much the same way as we do our `inner_battery`.  This requires us to make another copy of our `BATTERY` `StaticCell` init value.

Below the line
```rust
let battery_for_inner: &'static mut MockBatteryDevice = unsafe { &mut *(battery as *const _ as *mut _) };
```
add another:
```rust
let battery_for_inner2: &'static mut MockBatteryDevice = unsafe { &mut *(battery as *const _ as *mut _) };
```
and then change the `controller` declaration down below this to be
```rust
let controller = CONTROLLER.init(MockBatteryController::new(inner_battery, inner_charger));
```

and now you should be able to cleanly compile.  Running the program or tests will give you the same output as before; we haven't done anything with our new integrated charger yet.











