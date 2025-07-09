# Updating our simulated behaviors

When we run the app with `cargo run`, we see the battery discharge in the way we did before.
To update this so that the charger kicks in according to our rule, we need to connect this to a new task.

In `main.rs` add this new executor task at the bottom of the file:

```rust
#[embassy_executor::task]
async fn charger_rule_task(
    controller: &'static mut MockBatteryController<&'static mut MockBattery, &'static mut MockCharger>
) {
    loop {
        controller.poll_and_manage().await.unwrap();
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

### Run the stable battery

Running with `cargo run` should give you the familiar looking output of the battery discharging.  



