# Device and Controller

We’ve built the thermal pieces (mock **sensor** and **fan**). Now we’ll wrap them in a **device** and then a **controller** that plugs into the service layer—same pattern used by battery and charger.

> **Alternative: minimal approach (no device/controller)**
>
> Thermal is special: the service contracts are just HAL traits. If your HAL type already implements the required traits, you can register it directly (plus a tiny `CustomRequestHandler`), skipping the extra wrapper types. This is great for quick bring-up and simple policies.

#### Minimal sensor example (conceptual)

```rust
use thermal_service::sensor::{Controller as SensorController, CustomRequestHandler, Request, Response, Error};
use embedded_sensors_hal_async::temperature::{TemperatureSensor, TemperatureThresholdSet};

// Your HAL already implements TemperatureSensor + TemperatureThresholdSet.
impl CustomRequestHandler for MockSensor {
    fn handle_custom_request(&self, _: Request) -> impl core::future::Future<Output = Response> {
        async { Err(Error::InvalidRequest) }
    }
}

// Because the controller trait is just a composition of those traits,
// `&mut MockSensor` now satisfies the service’s controller requirements.
fn register_minimal(sensor: &'static mut MockSensor) {
    // SERVICE_REGISTRY.register(sensor);
    // (Use your actual service registration call here.)
}
```

#### Why this works for thermal

The controller trait is essentially `TemperatureSensor + TemperatureThresholdSet + CustomRequestHandler`,
so a HAL object can satisfy it directly. 

Battery/charger need richer state machines, so a dedicated controller adds real value there.

### Pros & cons of the minimal approach
| Pros | Cons |
|------|------|
| Very little code; fastest path to “it runs”. | Thin seams for policy (hysteresis, spin-up timing, logging).|
| No forwarding glue or feature-scope pitfalls. | Tighter coupling to the HAL; tests touch HAL details. |
| Perfect for basic polling + thresholds. | If you add comms/custom requests later, you’ll likely introduce a controller anyway. |

### Full Device and Controller Approach
For consistency if nothing else, we’ll use the full device/controller pattern. This gives us a clear separation of concerns and a consistent interface for policy management.  This is the same pattern we used for battery and charger components, so it should be familiar.

## Creating the Device
We will create a `MockThermalDevice` that wraps our mock sensor and fan components. 

Create a new file `src/mock_sensor_device.rs`, and give it this content:

```rust
use crate::mock_sensor::MockSensor;
use embedded_services::power::policy::DeviceId;
use embedded_services::power::policy::device::{Device, DeviceContainer};


pub struct MockSensorDevice {
    sensor: MockSensor,
    device: Device,
}

impl MockSensorDevice {
    pub fn new(id: DeviceId) -> Self {
    Self {
            sensor: MockSensor::new(),
            device: Device::new(id)
        }
    }

    pub fn get_internals(&mut self) -> (
        &mut MockSensor,
        &mut Device,
    ) {
        (
            &mut self.sensor,
            &mut self.device
        )
    }

    pub fn device(&self) -> &Device {
        &self.device
    }

    pub fn inner_sensor(&mut self) -> &mut MockSensor {
        &mut self.sensor
    }

}

impl DeviceContainer for MockSensorDevice {
    fn get_power_policy_device(&self) -> &Device {
        &self.device
    }
}
```
We are reminded here that a `Device` is just a wrapper to a single underlying component, and the service runtime serializes access to it. The `MockSensorDevice` wraps the `MockSensor` and provides a `Device` for service insertion.

### Ditto for the Fan
Create a new file `src/mock_fan_device.rs`, and give it this content:

```rust
use crate::mock_fan::MockFan;
use embedded_services::power::policy::DeviceId;
use embedded_services::power::policy::device::{Device, DeviceContainer};


pub struct MockFanDevice {
    fan: MockFan,
    device: Device,
}

impl MockFanDevice {
    pub fn new(id: DeviceId) -> Self {
    Self {
            fan: MockFan::new(),
            device: Device::new(id)
        }
    }

    pub fn get_internals(&mut self) -> (
        &mut MockFan,
        &mut Device,
    ) {
        (
            &mut self.fan,
            &mut self.device
        )
    }

    pub fn device(&self) -> &Device {
        &self.device
    }

    pub fn inner_fan(&mut self) -> &mut MockFan {
        &mut self.fan
    }

}

impl DeviceContainer for MockFanDevice {
    fn get_power_policy_device(&self) -> &Device {
        &self.device
    }
}
```

## Now for the Controllers
Next, we will create controllers for both the sensor and the fan. These controllers will implement the service traits and provide the necessary logic to interact with the devices.

We will start out with just the minimal pass-through implementation, but we can expand these later to include default logic to define the behavior of the thermal components.

### Mock Sensor Controller
Create a new file `src/mock_sensor_controller.rs`, and give it this content:

```rust
use crate::mock_sensor::{MockSensor, MockSensorError};
use crate::mock_sensor_device::MockSensorDevice;
use embedded_services::power::policy::device::Device;

use thermal_service::sensor::{CustomRequestHandler, Request, Response, Error};
use embedded_sensors_hal_async::temperature::{
    DegreesCelsius, TemperatureSensor, TemperatureThresholdSet
};
use embedded_sensors_hal_async::sensor::ErrorType;

pub struct MockSensorController {
    sensor: &'static mut MockSensor,
    _device: &'static mut Device
}

///
/// Temperature Sensor Controller
/// 
impl MockSensorController {
    pub fn new(device: &'static mut MockSensorDevice) -> Self {
        let (sensor, device) = device.get_internals();
        Self {
            sensor,
            _device: device
        }
    }
}

impl ErrorType for MockSensorController {
    type Error = MockSensorError;
}

impl CustomRequestHandler for &mut MockSensorController {
    fn handle_custom_request(&self, _request: Request) -> impl core::future::Future<Output = Response> {
        async { Err(Error::InvalidRequest) }
    }
}
impl TemperatureSensor for &mut MockSensorController {
    async fn temperature(&mut self) -> Result<DegreesCelsius, Self::Error> {
        self.sensor.temperature().await
    }
}
impl TemperatureThresholdSet for &mut MockSensorController {
    async fn set_temperature_threshold_low(&mut self, threshold: DegreesCelsius) -> Result<(), Self::Error> {
        self.sensor.set_temperature_threshold_low(threshold).await

    }

    async fn set_temperature_threshold_high(&mut self, threshold: DegreesCelsius) -> Result<(), Self::Error> {
        self.sensor.set_temperature_threshold_high(threshold).await
    }
}
```
No surprises here: the controller implements the service traits and provides a handle to the inner `MockSensor`. The `CustomRequestHandler` trait allows for custom requests, but we are not implementing any custom logic yet.

### Mock Fan Controller
Create a new file `src/mock_fan_controller.rs`, and give it this content:   

```rust 
use core::future::Future;
use crate::mock_fan::{MockFan, MockFanError};
use crate::mock_fan_device::MockFanDevice;
use embedded_services::power::policy::device::Device;

use embedded_fans_async::{Fan, ErrorType, RpmSense};

pub struct MockFanController {
    fan: &'static mut MockFan,
    _device: &'static mut Device
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
            _device: device
        }
    }
}

impl ErrorType for MockFanController {
    type Error = MockFanError;
}


impl Fan for MockFanController {
    fn min_rpm(&self) -> u16 {
        self.fan.min_rpm()
    }


    fn max_rpm(&self) -> u16 {
        self.fan.max_rpm()
    }

    fn min_start_rpm(&self) -> u16 {
        self.fan.min_start_rpm()
    }

    fn set_speed_rpm(&mut self, rpm: u16) -> impl Future<Output = Result<u16, Self::Error>> {
        self.fan.set_speed_rpm(rpm)
    }
}

impl RpmSense for MockFanController {
    fn rpm(&mut self) -> impl Future<Output = Result<u16, Self::Error>> {
        self.fan.rpm()
    }
}
```
We will be adding more to this later when we start defining the behavior of the thermal component, but for now, this is a simple pass-through controller that provides access to the `MockFan` and implements the necessary traits. If we wanted to keep the behavior logic external to this, then this is all we would need here.
