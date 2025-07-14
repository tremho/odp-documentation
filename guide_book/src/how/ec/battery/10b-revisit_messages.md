# Battery Event Messaging

So far we have constructed a flow that can send a BatteryEvent message as a test, but there's nothing handling it.

We are sending a `PollStaticData` event for our test message.  The `EspiService` code can't reasonably respond to that because:

1. It is not aware of the `MockBatteryController`.
2. Even if it was, the `Controller` functions are all async, and `EspiService` operates from a synchronous context.


## Open a Channel

You will recall we created our `BatteryChannel` type in `types.rs` and incorporated that into our `espi_service`

What `EspiService` _does_ do, is to route messages on to this asynchronous message queue (called a `Channel`).  
Then an event handler spawned as one of our main tasks can read from this queue and process the messages it receives.

We've already defined our Channel in `types.rs` in anticipation of this, and created it in the previous step.  

When we send a message to the `espi_service`, it is placing it upon this message queue.  But no-one is listening.

In the next few steps, we will listen to this channel for `BatteryEvent` messages and process them.
Create the new `event_handler_task` in `main.rs` as thus:
```rust
#[embassy_executor::task]
async fn event_handler_task(
    controller: &'static mut OurController,
    channel: &'static mut BatteryChannel
) {
    use battery_service::context::BatteryEventInner;

    println!("🛠️  Starting event handler...");

    let _ = controller; // ignore for now

    loop {
        let event = channel.receive().await;
        println!("🔔 event_handler_task received event: {:?}", event);
        match event.event {
            BatteryEventInner::PollStaticData => {
                println!("🔄 Handling PollStaticData");
            }
            BatteryEventInner::PollDynamicData => {
                println!("🔄 Handling PollDynamicData");
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
```

and add the spawn for that task along with the others:
```rust
spawner.spawn(event_handler_task(controller_for_handler, battery_channel_for_handler)).unwrap();
```
which will require you to add the cloned references above this:
```rust
    let battery_channel_for_handler = unsafe { &mut *(battery_channel as *const BatteryChannel as *mut BatteryChannel) };
    let controller_for_handler = unsafe { &mut *(controller as *const OurController as *mut OurController) };
```
Now, a `cargo run` will show that we now see the event message at our handler.

```
🛠️  Starting event handler...
🔄 Launching wrapper task...
🔌 Initializing battery fuel gauge service...
🔋 Launching battery service (single-threaded)
🧩 Registering battery device...
✅🔋 Battery service is up and running.
🔔 BATTERY_FUEL_READY signaled
✍ Sending test BatteryEvent...
✅ Test BatteryEvent sent
🔔 event_handler_task received event: BatteryEvent { event: PollStaticData, device_id: DeviceId(1) }
🔄 Handling PollStaticData
```

We have everything in place, and although we're still not doing anything with the message we receive, we can see that our event handler is indeed receiving it.

Next we will start the steps for handling the data.
