# Updating the Controller construction
Continuing our revisions to eliminate the unnecessary use of `duplicate_static_mut!` and adhere to a more canonical pattern that respects single ownership rules, we need to update the constructor for our component Controllers.
We also want to remove the unnecessary use of Generics in the design of these controllers.  We are only creating one variant of controller, there is no need to specify in a generic component in these cases, and generics are not only awkward to work with, they come with a certain amount of additional overhead.  This would be fine if we were actually taking advantage of different variant implementations, but since we are not, let's eliminate this now and simplify our design as long as we are making changes anyway.

## Updating the `MockChargerController` Constructor 
The `MockChargerController` currently takes both a `MockCharger` and a `MockChargerDevice` parameter.  The Controller doesn't actually use the `Device` context -- The `Device` is used to register the component with the service separately, but the component passed to the Controller must be the same as the one registered.  

For the `MockBatteryController`, we got around this by not passing the `MockBatteryDevice`, since it isn't used.  For the thermal components, `MockSensorController` and `MockFanController` are passed only the component `Device` instance and the component reference is extracted from here.

This latter approach is a preferable pattern because it ensures that the same component instance used for registration is also the one provided to the controller.  

We use the `get_internals()` method to return both the component and the `Device` instances instead of simply `inner_charger` because splitting the reference avoids inherent internal borrows on the same mutable 'self' reference.

Update `charger_project/mock_charger/src/mock_charger_controller.rs` so that the `MockChargerController` definition itself looks like this:

```rust
pub struct MockChargerController {
    pub charger: &'static mut MockCharger,
    pub device: &'static mut Device
}

impl MockChargerController
{    
    pub fn new(device: &'static mut MockChargerDevice) -> Self {
        let (charger, device) = device.get_internals();
        Self { charger, device }
    }
}
```
and then replace any references in the code of 
```rust
self.device.inner_charger()
```
to become
```rust
self.charger
```
and lastly, change
```rust
let inner = controller.charger;
```
to become
```rust
let inner = &controller.charger;
```
to complete the revisions for `MockChargerController`.

>📌 Why does `get_internals()` work where inner_charger() fails?
>
> This boils down to how the borrow checker sees the lifetime of the borrows.
>
> `inner_charger()` returns only `&mut MockCharger`,but the MockChargerDevice itself is still alive in the same scope. If you then also try to hand out `&mut Device` later, Rust sees that as two overlapping mutable borrows of the same struct, which is illegal.
>
> `get_internals()` instead performs both borrows inside the same method call and returns them as a tuple.
>
> This is a pattern the compiler can prove safe: it knows exactly which two disjoint fields are being borrowed at once, and it enforces that they don’t overlap.
>
> This is why controllers like our `MockSensorController`, `MockFanController`, and now `MockChargerController` can be cleanly instantiated with `get_internals()`. The `MockBatteryController` happens not to need this because it never touches the `Device` half of `MockBatteryDevice` — it only needs the component itself.

### The other Controllers
In our `MockSensorController` and `MockFanController` definitions, we did not make our `Device` or component members accessible, so we will change those now to do that and make them public:

In `mock_sensor_controller.rs`:
```rust
pub struct MockSensorController {
    pub sensor: &'static mut MockSensor,
    pub device: &'static mut Device
}

///
/// Temperature Sensor Controller
/// 
impl MockSensorController {
    pub fn new(device: &'static mut MockSensorDevice) -> Self {
        let (sensor, device) = device.get_internals();
        Self {
            sensor,
            device
        }
    }

```

In `mock_fan_controller.rs`:
```rust
pub struct MockFanController {
    pub fan: &'static mut MockFan,
    pub device: &'static mut Device
}

/// Fan controller.
///
/// This type implements [`embedded_fans_async::Fan`] and **inherits** the default
/// implementations of [`Fan::set_speed_percent`] and [`Fan::set_speed_max`].
///
/// Those methods are available on `MockFanController` without additional code here.
impl MockFanController {
    pub fn new(device: &'static mut MockFanDevice) -> Self {
        let (fan, device) = device.get_internals();
        Self {
            fan,
            device
        }
    }
```

We mentioned that we originally implemented `MockBatteryController` as being constructed without a `Device` element, but we _will_ need to access this device context later, so we should expose that as public member in the same way.  While we are at it, we should also eliminate the generic design of the structure definition, since it is only adding unnecessary complexity and inconsistency.

Update `battery_project/mock_battery/mock_battery_component.rs` so that it now looks like this (consistent with the others):

```rust
use battery_service::controller::{Controller, ControllerEvent};
use battery_service::device::{DynamicBatteryMsgs, StaticBatteryMsgs};
use embassy_time::{Duration, Timer};
use crate::mock_battery::{MockBattery, MockBatteryError};
use crate::mock_battery_device::MockBatteryDevice;
use embedded_services::power::policy::device::Device;
use embedded_batteries_async::smart_battery::{
    SmartBattery, ErrorType,
    ManufactureDate, SpecificationInfoFields, CapacityModeValue, CapacityModeSignedValue,
    BatteryModeFields, BatteryStatusFields,
    DeciKelvin, MilliVolts
};

pub struct MockBatteryController {
    /// The underlying battery instance that this controller manages.
    pub battery: &'static mut MockBattery,
    pub device: &'static mut Device

}

impl MockBatteryController
{
    pub fn new(battery_device: &'static mut MockBatteryDevice) -> Self {
        let (battery, device) = battery_device.get_internals();
        Self {
            battery,
            device
        }
    }
}

impl ErrorType for MockBatteryController
{
    type Error = MockBatteryError;
}
impl SmartBattery for MockBatteryController
{
    async fn temperature(&mut self) -> Result<DeciKelvin, Self::Error> {
        self.battery.temperature().await
    }

    async fn voltage(&mut self) -> Result<MilliVolts, Self::Error> {
        self.battery.voltage().await
    }

    async fn remaining_capacity_alarm(&mut self) -> Result<CapacityModeValue, Self::Error> {
        self.battery.remaining_capacity_alarm().await
    }

    async fn set_remaining_capacity_alarm(&mut self, _: CapacityModeValue) -> Result<(), Self::Error> {
        self.battery.set_remaining_capacity_alarm(CapacityModeValue::MilliAmpUnsigned(0)).await
    }

    async fn remaining_time_alarm(&mut self) -> Result<u16, Self::Error> {
        self.battery.remaining_time_alarm().await
    }

    async fn set_remaining_time_alarm(&mut self, _: u16) -> Result<(), Self::Error> {
        self.battery.set_remaining_time_alarm(0).await
    }

    async fn battery_mode(&mut self) -> Result<BatteryModeFields, Self::Error> {
        self.battery.battery_mode().await
    }

    async fn set_battery_mode(&mut self, _: BatteryModeFields) -> Result<(), Self::Error> {
        self.battery.set_battery_mode(BatteryModeFields::default()).await
    }

    async fn at_rate(&mut self) -> Result<CapacityModeSignedValue, Self::Error> {
        self.battery.at_rate().await
    }

    async fn set_at_rate(&mut self, _: CapacityModeSignedValue) -> Result<(), Self::Error> {
        self.battery.set_at_rate(CapacityModeSignedValue::MilliAmpSigned(0)).await
    }

    async fn at_rate_time_to_full(&mut self) -> Result<u16, Self::Error> {
        self.battery.at_rate_time_to_full().await
    }

    async fn at_rate_time_to_empty(&mut self) -> Result<u16, Self::Error> {
        self.battery.at_rate_time_to_empty().await
    }

    async fn at_rate_ok(&mut self) -> Result<bool, Self::Error> {
        self.battery.at_rate_ok().await
    }

    async fn current(&mut self) -> Result<i16, Self::Error> {
        self.battery.current().await
    }

    async fn average_current(&mut self) -> Result<i16, Self::Error> {
        self.battery.average_current().await
    }

    async fn max_error(&mut self) -> Result<u8, Self::Error> {
        self.battery.max_error().await
    }

    async fn relative_state_of_charge(&mut self) -> Result<u8, Self::Error> {
        self.battery.relative_state_of_charge().await
    }

    async fn absolute_state_of_charge(&mut self) -> Result<u8, Self::Error> {
        self.battery.absolute_state_of_charge().await
    }

    async fn remaining_capacity(&mut self) -> Result<CapacityModeValue, Self::Error> {
        self.battery.remaining_capacity().await
    }

    async fn full_charge_capacity(&mut self) -> Result<CapacityModeValue, Self::Error> {
        self.battery.full_charge_capacity().await
    }

    async fn run_time_to_empty(&mut self) -> Result<u16, Self::Error> {
        self.battery.run_time_to_empty().await
    }

    async fn average_time_to_empty(&mut self) -> Result<u16, Self::Error> {
        self.battery.average_time_to_empty().await
    }

    async fn average_time_to_full(&mut self) -> Result<u16, Self::Error> {
        self.battery.average_time_to_full().await
    }

    async fn charging_current(&mut self) -> Result<u16, Self::Error> {
        self.battery.charging_current().await
    }

    async fn charging_voltage(&mut self) -> Result<u16, Self::Error> {
        self.battery.charging_voltage().await
    }

    async fn battery_status(&mut self) -> Result<BatteryStatusFields, Self::Error> {
        self.battery.battery_status().await
    }

    async fn cycle_count(&mut self) -> Result<u16, Self::Error> {
        self.battery.cycle_count().await
    }

    async fn design_capacity(&mut self) -> Result<CapacityModeValue, Self::Error> {
        self.battery.design_capacity().await
    }

    async fn design_voltage(&mut self) -> Result<u16, Self::Error> {
        self.battery.design_voltage().await
    }

    async fn specification_info(&mut self) -> Result<SpecificationInfoFields, Self::Error> {
        self.battery.specification_info().await
    }

    async fn manufacture_date(&mut self) -> Result<ManufactureDate, Self::Error> {
        self.battery.manufacture_date().await
    }   

    async fn serial_number(&mut self) -> Result<u16, Self::Error> {
        self.battery.serial_number().await
    }

    async fn manufacturer_name(&mut self, v: &mut [u8]) -> Result<(), Self::Error> {
        self.battery.manufacturer_name(v).await
    }

    async fn device_name(&mut self, v: &mut [u8]) -> Result<(), Self::Error> {
        self.battery.device_name(v).await
    }

    async fn device_chemistry(&mut self, v: &mut [u8]) -> Result<(), Self::Error> {
        self.battery.device_chemistry(v).await
    }    
}

impl Controller for MockBatteryController
{
    type ControllerError = MockBatteryError;

    async fn initialize(&mut self) -> Result<(), Self::ControllerError> {
        Ok(())
    }

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
        let charging_voltage_mv = 0; // no charger implemented yet
        let charging_current_ma = 0; // no charger implemented yet
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

    async fn get_device_event(&mut self) -> ControllerEvent {
        loop {
            Timer::after(Duration::from_secs(60)).await;
        }
    }

    async fn ping(&mut self) -> Result<(), Self::ControllerError> {
        Ok(())
    }

    fn get_timeout(&self) -> Duration {
        Duration::from_secs(10)
    }

    fn set_timeout(&mut self, _duration: Duration) {
        // Ignored for mock
    }
}
```

Now we have a consistent and rational pattern to each of our controller models.

As previously mentioned, note that these changes break the constructor calling in the previous example exercises, so if you are intent on keeping the previous exercises building, you will need to refactor those.
You would need to change any references to MockBatteryController<MockBattery> in any of the existing code that uses the former version to be simply `MockBatteryController` and will need to update any calls to the constructor to pass the `MockBatteryDevice` instance instead of `MockBattery`.
There are likely other ramifications with regard to multiple borrows that still remain in the previous code that you will have to choose how to mitigate as well.

### As long as we're updating controllers...
An oversight in the implementation of some of the `SmartBattery` traits of `MockBatteryController` fail to pass the buffer parameter down into the underlying implementation.  Although this won't materially affect the build here, it should be remedied. Replace these methods in `battery_project/mock_battery/src/mock_battery_controller.rs` with the versions below:

```rust
    async fn manufacturer_name(&mut self, buf: &mut [u8]) -> Result<(), Self::Error> {
        self.battery.manufacturer_name(buf).await
    }

    async fn device_name(&mut self, buf: &mut [u8]) -> Result<(), Self::Error> {
        self.battery.device_name(buf).await
    }

    async fn device_chemistry(&mut self, buf: &mut [u8]) -> Result<(), Self::Error> {
        self.battery.device_chemistry(buf).await
    }    
```








