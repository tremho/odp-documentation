# Using the ODP repositories for defined Thermal traits

The ODP repositories contain the necessary traits and services for building a thermal subsystem. We will use these traits to define the behavior of our mock thermal component.  These traits define the interface for the controller, and therefore inform the implementation of the components.

## Thermal component Traits
The Sensor component has traits defined by the `embedded-sensors-hal-async` crate, which provides the necessary traits for sensor operations. The Fan component has traits defined by the `embedded-fans-async` crate, which provides the necessary traits for fan operations.

### Sensor Traits
`TemperatureSensor` is the trait that defines the behavior of a temperature sensor. It is a very simple interface that contains only a single method, `temperature`, which returns the current temperature reading. 

`TemperatureThresholdSet` is a trait that defines the setting of high/low temperature thresholds. Our our implementation will use this, as well as defining some associated events, and will build a default policy around how to orchestrate behavior based on these thresholds and the temperature readings.

### Fan Traits
`Fan` is the trait that defines the behavior of a fan. It contains methods for reading the current fan speed, setting the fan speed, and setting the min, max and starting speed values.

`RpmSense` is the defined trait for returning the current RPM of the fan. 


### Pass it on down
The traits methods appear first in the implementation of the controller, which will be reacting to event messages that come from the service layer in an integrated system.  In most cases, the functionality is passed through to the underlying layers of the component.  All hardware-related state management is handled at the HAL layer (or in our case, virtual layer), the decision logic is handled via the controller so that it can conduct this orchestration.


## Implementing the Traits
Let's start with the Sensor component. We will implement the `TemperatureSensor` and `TemperatureThresholdSet` traits in our mock sensor component.

Before we do that, we will need to define the HAL traits that will be used to access the hardware. As with our other mock examples, we are not connecting to any real hardware, so we will define a virtual sensor with the traits we need.

Create a new file in the `thermal_project` workspace, `src/virtual_temperature.rs`, and give it this content:

```rust
use embedded_sensors_hal_async::temperature::DegreesCelsius;

#[derive(Copy, Clone, Debug)]
pub struct VirtualTemperatureState {
    pub temperature: DegreesCelsius,
    pub threshold_low: DegreesCelsius,
    pub threshold_high: DegreesCelsius
}

impl VirtualTemperatureState {
    pub fn new() -> Self {
        Self {
            temperature: 0.0,
            threshold_low: f32::NEG_INFINITY,
            threshold_high: f32::INFINITY
        }
    }
}
```
And then we can use this as the basis for our mock sensor implementation.

Create a new file in the `thermal_project` workspace, `src/mock_sensor.rs`, and give it this content:

```rust
use embedded_sensors_hal_async::sensor;
use embedded_sensors_hal_async::temperature::{DegreesCelsius, TemperatureSensor, TemperatureThresholdSet};
use crate::virtual_temperature::VirtualTemperatureState;

#[derive(Copy, Clone, Debug)]
pub struct MockSensor {
    temperature_state:VirtualTemperatureState
}

#[derive(Clone, Debug)]
pub struct MockSensorError;
impl sensor::Error for MockSensorError {
    fn kind(&self) -> sensor::ErrorKind {
        sensor::ErrorKind::Other
    }
}

impl sensor::ErrorType for MockSensor {
    type Error = MockSensorError;
}

impl MockSensor {
    pub fn new() -> Self {
        Self {
            temperature_state: VirtualTemperatureState::new()
        }
    }
    pub fn get_temperature(&self) -> f32 {
        self.temperature_state.temperature
    }
    pub fn get_threshold_low(&self) -> f32 {
        self.temperature_state.threshold_low
    }
    pub fn get_threshold_high(&self) -> f32 {
        self.temperature_state.threshold_high
    }
    pub fn set_temperature(&mut self, temperature: DegreesCelsius) {
        self.temperature_state.temperature = temperature;
    }
}

impl TemperatureSensor for MockSensor {
    async fn temperature(&mut self) -> Result<DegreesCelsius, Self::Error> {
        let d : DegreesCelsius = self.temperature_state.temperature;
        Ok(d)
    }
}

impl TemperatureThresholdSet for MockSensor {
    async fn set_temperature_threshold_low(&mut self, threshold: DegreesCelsius) -> Result<(), Self::Error> {
        self.temperature_state.threshold_low = threshold;
        Ok(())
    }

    async fn set_temperature_threshold_high(&mut self, threshold: DegreesCelsius) -> Result<(), Self::Error> {
        self.temperature_state.threshold_high = threshold;
        Ok(())
    }
}
```
As you can see, we have implemented the `TemperatureSensor` and `TemperatureThresholdSet` traits for our `MockSensor` component. The actual state values are stored in the `VirtualTemperatureState` struct, which is used to simulate the behavior of a real temperature sensor. This is where a real sensor would read from hardware, but in our case we are simply simulating the behavior.

### Fan Component Implementation
Next, we will implement the Fan component. Just like with the sensor, we will define a virtual fan state and then implement the `Fan` and `RpmSense` traits.

Create a new file in the `thermal_project` workspace, for example `src/virtual_fan.rs`, and give it this content:

```rust

pub const FAN_RPM_MINIMUM: u16 = 1000;  // minimum speed in operation
pub const FAN_RPM_MAXIMUM: u16 = 5000;  // maximum speed in operation
pub const FAN_RPM_START: u16 = 1000;    // minimum speed at which to start fan

pub struct VirtualFanState {
    pub rpm: u16,
    pub min_rpm: u16,
    pub max_rpm: u16,
    pub min_start_rpm: u16
}

impl VirtualFanState {
    pub fn new() -> Self {
        Self {
            rpm: 0,
            min_rpm: FAN_RPM_MINIMUM,
            max_rpm: FAN_RPM_MAXIMUM,
            min_start_rpm: FAN_RPM_START
        }
    }
}
```
And then we can use this as the basis for our mock fan implementation.

Create a new file `src/mock_fan.rs`, and give it this content:

```rust
use embedded_fans_async::{Fan, Error, ErrorKind, ErrorType, RpmSense};

use crate::virtual_fan::VirtualFanState;


#[derive(Copy, Clone, Debug)]
pub struct MockFanError;  
impl Error for MockFanError {
    fn kind(&self) -> embedded_fans_async::ErrorKind {
        ErrorKind::Other
    }
}
pub struct MockFan {
    fan_state: VirtualFanState
}

impl MockFan {
    pub fn new() -> Self {
        Self {
            fan_state: VirtualFanState::new()
        }
    }
    fn current_rpm(&self) -> u16 {
        self.fan_state.rpm
    }
}

impl ErrorType for MockFan {
    type Error = MockFanError;
}

impl Fan for MockFan {    
    fn min_rpm(&self) -> u16 {
        self.fan_state.min_rpm
    }

    fn max_rpm(&self) -> u16 {
        self.fan_state.max_rpm
    }

    fn min_start_rpm(&self) -> u16 {
        self.fan_state.min_start_rpm
    }

    async fn set_speed_rpm(&mut self, rpm: u16) -> Result<u16, Self::Error> {
        self.fan_state.rpm = rpm;
        Ok(rpm)
    }
}

impl RpmSense for MockFan {
    async fn rpm(&mut self) -> Result<u16, Self::Error> {
        Ok(self.current_rpm())
    }
}
```
Similar to the Sensor pattern, we have implemented the `Fan` and `RpmSense` traits for our `MockFan` component. The actual state values are stored in the `VirtualFanState` struct, and this component is really just a wrapper around that state that respects the trait definitions.
