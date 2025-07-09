# Adding the charger to the Battery Device

We won't be creating a new project for the Charger, as it is an extension to the Battery Device implementation we have already constructed.  But we do need to modify that project to accept a charger.

For the Charger exercise, we will:

- Add the Charger to the BatteryDevice
- Integrate the BatteryController to be aware of this
- Update our battery simulation to account for virtual charger behavior
- Perform unit tests
- Perform a simple integration test of behavior 

## Creating the Charger component

You will recall that when we created the `MockBattery`, we implemented it in two files `mock_battery.rs`, and `virtual_battery.rs`. This separation was not only to organize the code, but to delineate between the conceptual class and the implementation that might as well be an actual HAL implementation.  We put the states and the simulated behaviors in the `virtual_battery.rs` file, and referenced this in the canonical `mock_battery.rs` traits implementations.

We'll follow this same pattern for our charger, we'll add two new files to the sources in `battery_project/mock_battery/src`: `mock_charger.rs` and `virtual_charger.rs`

Return to  your Battery Project and create the source file `mock_charger.rs` and give it this content:

```rust

use embedded_batteries_async::charger::{
    Charger, Error, ErrorType, ErrorKind
};
pub use embedded_batteries::{MilliAmps, MilliVolts};
use crate::virtual_charger::VirtualChargerState;
use crate::mutex::{Arc, Mutex, RawMutex};


const MAXIMUM_ALLOWED_CURRENT:u16 = 3000;
const MAXIMUM_ALLOWED_VOLTAGE:u16 = 15000;

#[derive(Debug)]
pub enum MockChargerError {}

impl core::fmt::Display for MockChargerError {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        write!(f, "MockChargerError")
    }
}

impl Error for MockChargerError {
    fn kind(&self) -> ErrorKind {
        ErrorKind::Other
    }    
}


pub struct MockCharger {
    pub state: Arc<Mutex<RawMutex, VirtualChargerState>>,
}

impl MockCharger {
    pub fn new() -> Self {
        Self {
            state: Arc::new(Mutex::new(VirtualChargerState::new()))
        }
    }
}

impl ErrorType for MockCharger {
    type Error = MockChargerError;
}

#[allow(refining_impl_trait)]
impl Charger for MockCharger {

    fn charging_current(&mut self, requested_current: MilliAmps) -> impl Future<Output = Result<MilliAmps, Self::Error>> {
        let state = self.state.clone();
        async move {
            let mut lock = state.lock().await;
            let mut req_cur = requested_current;
            if req_cur < MAXIMUM_ALLOWED_CURRENT {
                lock.set_current(req_cur);
            } else {
                req_cur = lock.current();
            }
            Ok(req_cur)
        }
    }

    fn charging_voltage(&mut self, requested_voltage: MilliVolts) -> impl Future<Output = Result<MilliVolts, Self::Error>> {
        let state = self.state.clone();
        async move {
            let mut lock = state.lock().await;
            let mut req_volt = requested_voltage;
            if req_volt < MAXIMUM_ALLOWED_VOLTAGE {
                lock.set_voltage(req_volt);
            } else {
                req_volt = lock.voltage();
            }
            Ok(req_volt)
        }
    }
}
```
All this does is implement the two traits of the `Charger` interface (`charging_current` and `charging_voltage`), and returns a 0 value result in terms of its inner `VirtualChargerState`, which we will look at next.
It is interesting to note that `Charger` only offers _setters_ in `charging_current` and `charging_voltage`. The interface is curiously absent of corresponding _getter_ methods.  We'll see this again later.  

>### Async Trait methods
>Like we saw in the `mock_battery.rs` implementation, we are using `impl Future<...` as the return type because rust does not
>(yet) support async methods for Traits. We follow the same pattern we implemented there for these methods.


Now, add these contents to `virtual_charger.rs`:

```rust
// src/virtual_charger.rs

use embedded_batteries_async::charger::{MilliAmps, MilliVolts};

#[derive(Debug, Default)]
pub struct VirtualChargerState {
    pub last_requested_current: MilliAmps,
    pub last_requested_voltage: MilliVolts,
}

impl VirtualChargerState {
    pub fn new() -> Self {
        Self {
            last_requested_current: 0,
            last_requested_voltage: 0,
        }
    }
    pub fn set_current(&mut self, requested_current:MilliAmps) -> MilliAmps {
        self.last_requested_current = requested_current;
        self.last_requested_current
    }
    pub fn set_voltage(&mut self, requested_voltage:MilliVolts) -> MilliVolts {
        self.last_requested_voltage = requested_voltage;
        self.last_requested_voltage
    }
    pub fn current(&self) -> MilliAmps {
        self.last_requested_current
    }
    pub fn voltage(&self) -> MilliVolts {
        self.last_requested_voltage
    }
}
```
It doesn't do much except hold state, but that's all that is required.  We could have also simply implemented this directly
in `MockCharger`, but in keeping with our pattern in deference to what _could be_ a HAL layer, we maintain the separation.

The last step for this part is to include our `MockCharger` as part of our `MockBatteryDevice`. 

Edit `mock_battery_device.rs` and add the inner charger property to the structure and its impl block:

```rust
pub struct MockBatteryDevice {
    battery: MockBattery,
    charger: MockCharger,
    device: Device,
}

impl MockBatteryDevice {
    pub fn new(id: DeviceId) -> Self {
    Self {
            battery: MockBattery::new(),
            charger: MockCharger::new(),
            device: Device::new(id)
        }
    }

```

and add an `inner_charger` accessor to match the existing `inner_battery` method:

```rust
    pub fn inner_battery(&mut self) -> &mut MockBattery {
        &mut self.battery
    }   
    
    pub fn inner_charger(&mut self) -> &mut MockCharger {
        &mut self.charger
    }   
```

### Keeping lib.rs updated
Make sure to add the new module files to `lib.rs`:
```rust
pub mod mock_battery;
pub mod virtual_battery;
pub mod mock_battery_device;
pub mod espi_service;
pub mod mock_battery_controller;
pub mod types;
pub mod mutex;
pub mod test_helper;
pub mod mock_charger;
pub mod virtual_charger;
```

Now we are ready to attach this to the `MockBatteryController`.




