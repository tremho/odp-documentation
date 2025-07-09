# Updating our simulated behaviors

When we run the app with `cargo run`, we see the battery discharge in the way we did before.
To update this so that the charger kicks in according to our rule, we need to connect this to a new task.

### The charger rule task

In `main.rs` add this new executor task at the bottom of the file:

```rust
#[embassy_executor::task]
async fn charger_rule_task(
    controller: &'static mut MockBatteryController<&'static mut MockBattery, &'static mut MockCharger>
) {
    loop {
        controller.poll_and_manage_charger().await.unwrap();
        let seconds = controller.get_timeout().await.unwrap();
        Timer::after(Duration::from_secs(seconds)).await;
    }
}
```
This task will call our `poll_and_manage()` function at an interval defined by the controller `get_timeout()` method.
>_(The `get_timeout()` method was originally stubbed in with a 10-second interval.  This is fine as it is.  But if you like,
you might want to add a CHARGER_POLL_SECONDS constant to the other constants at the top of `mock_battery_controller.rs` and use this value instead of the hard-coded `10` currently in `get_timeout()`, or implement the complementary `set_timeout()` instead of using a constant in the file, and call this in `main()` before starting the task.)_

We then need to start the task in `main()` as one of our `executor.run(` task launches:
```rust
spawner.spawn(charger_rule_task(controller_for_poll)).unwrap();
```
which also requires us to make the `controller_for_poll` copy above:
```rust
let controller_for_poll = unsafe { &mut *(controller as *const _ as *mut _) };
```

### Updateing the simulation task
We also need to update our `simulation_task` to accept a new passed-in parameter for the charger and use it.

Replace the existing `simulation_task` with this updated version:
```rust
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
```
and we need to update the `spawn` call for this in our `main()`:
```rust
        spawner.spawn(simulation_task(battery_for_sim.inner_battery(), battery_for_sim2.inner_charger(), 50.0)).unwrap();
```
which will require us to create the `battery_for_sim2` reference above, right below `battery_for_sim`:
```rust
    let battery_for_sim: &'static mut MockBatteryDevice = unsafe { &mut *(battery as *const _ as *mut _) };
    let battery_for_sim2: &'static mut MockBatteryDevice = unsafe { &mut *(battery as *const _ as *mut _) };
```


## Run the stable battery

Running with `cargo run` should give you the familiar looking output of the battery discharging.  
But after a while, once it reaches below 90% charge capacity within the polling window of the `charger_rule_task`, you will see the  call to `poll_and_manage_charger` have its effect and turn on the charger.  The charge capacity will rise until it reaches the 90%
mark, and then start going down again.  The battery will remain at a continual charge somewhere between about 87 - 90 % from hereon, depending upon the timing window effects.

Now, of course, this isn't a very good implementation for a true real-world battery, which would use a more sophisticated algorithm to ramp the charging levels according to capacity and load (and other factors, such as thermal conditions), and in this simple simulation we are ust using constants for charge/discharge values, but the realism of the simulation is not really the point. 

We now see an integrated battery behavior including charging.  Let's move now beyond console output and into some testing.






