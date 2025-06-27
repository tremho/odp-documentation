## Mocking Battery Behavior
We now have the component parts of our battery subsystem assembled and it is ready process the messages it receives at the event handler.

### Handling the messages

For right now, we are going to continue to make use of our `println!` output in our std context to show us the data our battery
produces in response to the messages it receives.

#### Handling static data
Our current test message is `PollStaticData`.  The data from this message is typically cached so that it does not have to do hardware access on each request.  We'll implement a simple cache here.

In your `main.rs` file, add the following imports:

```rust
use embassy_sync::mutex::Mutex;
use battery_service::device::StaticBatteryMsgs;
```
and add this to your static section:

```rust
static STATIC_BATTERY_DATA: StaticCell<Mutex<NoopRawMutex, Option<StaticBatteryMsgs>>> = StaticCell::new();
```
This will set up a static storage space we can use as our cache.

In `main()`, init this:

```rust
let static_data_mutex = STATIC_BATTERY_DATA.init(Mutex::new(None));
```
and include it as an additional parameter to event_handler_task:

```rust
    spawner.spawn(event_handler_task(controller_for_handler, battery_channel_for_handler, static_data_mutex)).unwrap();
```
update the event handler:
```rust
#[embassy_executor::task]
async fn event_handler_task(
    mut controller: &'static mut MockBatteryController<&'static mut MockBattery>,
    channel: &'static mut BatteryChannel,
    static_data: &'static Mutex<NoopRawMutex, Option<StaticBatteryMsgs>>
) {
    use battery_service::context::BatteryEventInner;

    println!("🛠️  Starting event handler...");

    loop {
        let event = channel.receive().await;
        println!("🔔 event_handler_task received event: {:?}", event);
        match event.event {
            BatteryEventInner::PollStaticData => {
                println!("🔄 Handling PollStaticData");
                let _ = controller.get_static_data().await;

                let mut lock = static_data.lock().await;
                if lock.is_none() {
                    println!("📊 Fetching static battery data for the first time");
                    let result = controller.get_static_data().await;
                    *lock = Some(result.unwrap()); // or handle error properly
                }

                if let Some(cached) = &*lock {
                    println!("📊 Static battery data: {:?}", cached);
                }
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
Now it will check the cache, and if not filled, call upon the controller to get the static data, cache it, and print it out.

Output now should look like:

```
🛠️  Starting event handler...
🔄 Launching wrapper task...
🔌 EspiService init()
🧩 Registering ESPI service endpoint...
🕒 time_driver started
🔌 Initializing battery fuel gauge service...
🔋 Launching battery service (single-threaded)
🧩 Registering battery device...
✅🔋 Battery service is up and running.
✅🔌 EspiService READY
🔔 BATTERY_FUEL_READY signaled
✍ Sending test BatteryEvent...
📬 EspiService received message: Message { from: Internal(Battery), to: Internal(Battery), data: Data { contents: Any { .. } } }
✅ Test BatteryEvent sent
🔔 event_handler_task received event: BatteryEvent { event: PollStaticData, device_id: DeviceId(1) }
🔄 Handling PollStaticData
📊 Fetching static battery data for the first time
📊 Static battery data: StaticBatteryMsgs { manufacturer_name: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], device_name: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], device_chemistry: [0, 0, 0, 0, 0], design_capacity_mwh: 0, design_voltage_mv: 0, device_chemistry_id: [0, 0], serial_num: [0, 0, 0, 0] }
```

We can see the data is all zeroes.

___But wait! Didn't we populate MockBattery with some arbitrary, but non-zero values?___

Yes.  We did.  And we made sure our MockBatteryController forwarded all of its `SmartBattery` traits to its inner battery.
But we did not implement the `BatteryController` traits for this with anything other than default (0) values.

### Implementing `get_static_data` at the `MockBatteryController`

If we look at `mock_battery_controller.rs` we see the existing code for `get_static_data` is simply:

```rust
async fn get_static_data(&mut self) -> Result<StaticBatteryMsgs, Self::ControllerError> {
        Ok(StaticBatteryMsgs { ..Default::default() })
}
```

The `StaticBatteryMsgs` structure is made up of series of named data elements:
```rust
    pub manufacturer_name: [u8; 21],
    pub device_name: [u8; 21],
    pub device_chemistry: [u8; 5],
    pub design_capacity_mwh: u32,
    pub design_voltage_mv: u16,
```
that we must fill from the data available from the battery.
            
```rust
    async fn get_static_data(&mut self) -> Result<StaticBatteryMsgs, Self::ControllerError> {
        let mut name = [0u8; 21];
        let mut device = [0u8; 21];
        let mut chem = [0u8; 5];

        println!("MockBatteryController: Fetching static data");

        self.battery.manufacturer_name(&mut name).await?;
        self.battery.device_name(&mut device).await?;
        self.battery.device_chemistry(&mut chem).await?;

        let capacity = match self.battery.design_capacity().await? {
            CapacityModeValue::MilliAmpUnsigned(v) => v,
            _ => 0,
        };

        let voltage = self.battery.design_voltage().await?;

        // This is a placeholder, replace with actual logic to determine chemistry ID
        // For example, you might have a mapping of chemistry names to IDs       
        let chem_id = [0x01, 0x02]; // example
        
        // Serial number is a 16-bit value, split into 4 bytes
        // where the first two bytes are zero   
        let raw = self.battery.serial_number().await?;
        let serial = [0, 0, (raw >> 8) as u8, (raw & 0xFF) as u8];

        Ok(StaticBatteryMsgs {
            manufacturer_name: name,
            device_name: device,
            device_chemistry: chem,
            design_capacity_mwh: capacity as u32,
            design_voltage_mv: voltage,
            device_chemistry_id: chem_id,
            serial_num: serial,
        })
    }    
```

Now when we run, we should see our MockBattery data represented:

```
🛠️  Starting event handler...
🔄 Launching wrapper task...
🔌 EspiService init()
🧩 Registering ESPI service endpoint...
🕒 time_driver started
🔌 Initializing battery fuel gauge service...
🔋 Launching battery service (single-threaded)
🧩 Registering battery device...
✅🔋 Battery service is up and running.
✅🔌 EspiService READY
🔔 BATTERY_FUEL_READY signaled
✍ Sending test BatteryEvent...
📬 EspiService received message: Message { from: Internal(Battery), to: Internal(Battery), data: Data { contents: Any { .. } } }
✅ Test BatteryEvent sent
🔔 event_handler_task received event: BatteryEvent { event: PollStaticData, device_id: DeviceId(1) }
🔄 Handling PollStaticData
MockBatteryController: Fetching static data
📊 Static battery data: Ok(StaticBatteryMsgs { manufacturer_name: [77, 111, 99, 107, 66, 97, 116, 116, 101, 114, 121, 67, 111, 114, 112, 0, 0, 0, 0, 0, 0], device_name: [77, 66, 45, 52, 50, 48, 48, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], device_chemistry: [76, 73, 79, 78, 0], design_capacity_mwh: 5000, design_voltage_mv: 7800, device_chemistry_id: [1, 2], serial_num: [0, 0, 48, 57] })
```

So, very good.  Now we can do essentially the same thing for `get_dynamic_data`.

First, let's issue the `PollDynamicData` message.  We'll add this to our 



