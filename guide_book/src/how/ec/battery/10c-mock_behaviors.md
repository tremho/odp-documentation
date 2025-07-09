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

First, let's issue the `PollDynamicData` message.  This is just temporary, so just add this to the bottom of your
existing `test_message_sender` task:

```rust
    // now for the dynamic data:
    let event2 = BatteryEvent {
        device_id: DeviceId(1),
        event: BatteryEventInner::PollDynamicData,
    };

    if let Err(e) = svc.endpoint.send(
        EndpointID::Internal(embedded_services::comms::Internal::Battery),
        &event2,
    ).await {
        println!("❌ Failed to send test BatteryEvent: {:?}", e);
    } else {
        println!("✅ Test BatteryEvent sent");
    }
```

and in the `event_handler_task`:

```rust
    BatteryEventInner::PollDynamicData => {
        println!("🔄 Handling PollDynamicData");
        let dd  = controller.get_dynamic_data().await;
        println!("📊 Static battery data: {:?}", dd);
    }
```
will suffice for a quick report.

Now, implement into `mock_battery_controller.rs` in the `Controller` implementation for `get_dynamic_data` as this:

```rust

    async fn get_dynamic_data(&mut self) -> Result<DynamicBatteryMsgs, Self::ControllerError> {
        println!("MockBatteryController: Fetching dynamic data");

        // Pull values from SmartBattery trait
        let full_capacity = match self.battery.full_charge_capacity().await? {
            CapacityModeValue::MilliAmpUnsigned(val) => val as u32,
            _ => 0,
        };

        let remaining_capacity = match self.battery.remaining_capacity().await? {
            CapacityModeValue::MilliAmpUnsigned(val) => val as u32,
            _ => 0,
        };

        let battery_status = {
            let status = self.battery.battery_status().await?;
            // Bit masking matches the SMS specification
            let mut result: u16 = 0;
            result |= (status.fully_discharged() as u16) << 0;
            result |= (status.fully_charged() as u16) << 1;
            result |= (status.discharging() as u16) << 2;
            result |= (status.initialized() as u16) << 3;
            result |= (status.remaining_time_alarm() as u16) << 4;
            result |= (status.remaining_capacity_alarm() as u16) << 5;
            result |= (status.terminate_discharge_alarm() as u16) << 7;
            result |= (status.over_temp_alarm() as u16) << 8;
            result |= (status.terminate_charge_alarm() as u16) << 10;
            result |= (status.over_charged_alarm() as u16) << 11;
            result |= (status.error_code() as u16) << 12;
            result
        };

        let relative_soc_pct = self.battery.relative_state_of_charge().await? as u16;
        let cycle_count = self.battery.cycle_count().await?;
        let voltage_mv = self.battery.voltage().await?;
        let max_error_pct = self.battery.max_error().await? as u16;
        let charging_voltage_mv = self.battery.charging_voltage().await?;
        let charging_current_ma = self.battery.charging_current().await?;
        let battery_temp_dk = self.battery.temperature().await?;
        let current_ma = self.battery.current().await?;
        let average_current_ma = self.battery.average_current().await?;

        // For now, placeholder sustained/max power
        let max_power_mw = 0;
        let sus_power_mw = 0;

        Ok(DynamicBatteryMsgs {
            max_power_mw,
            sus_power_mw,
            full_charge_capacity_mwh: full_capacity,
            remaining_capacity_mwh: remaining_capacity,
            relative_soc_pct,
            cycle_count,
            voltage_mv,
            max_error_pct,
            battery_status,
            charging_voltage_mv,
            charging_current_ma,
            battery_temp_dk,
            current_ma,
            average_current_ma,
        })
    }        
```
You can see that this is similar to what was done for `get_static_data`.

Now run and you will see representative values that come from your current `MockBattery` implementation:

```
🔄 Handling PollDynamicData
MockBatteryController: Fetching dynamic data
📊 Static battery data: Ok(DynamicBatteryMsgs { max_power_mw: 0, sus_power_mw: 0, full_charge_capacity_mwh: 4800, remaining_capacity_mwh: 4200, relative_soc_pct: 88, cycle_count: 100, voltage_mv: 7500, max_error_pct: 1, battery_status: 0, charging_voltage_mv: 8400, charging_current_ma: 2000, battery_temp_dk: 2950, current_ma: 1500, average_current_ma: 1400 })
```


