# Charger Traits

The `embedded-batteries` crates define a `Charger` interface. This interface contains only two methods: `charging_current` and `charging_voltage`.  These functions are defined as `setters`, although they also return the available value after setting.

These should be interpreted as the policy manager asking: "I'm going to give you a value I want, and you will report back to me the value you are able to supply". Real-world circuitry will have physical limitations to what it can do for any given request, so it is important to take these factors into consideration when implementing a HAL-layer control.

For our virtualized charger, we have no such real-world constraints, but we will still define and respect certain maximum thresholds. We will check if these thresholds are honored later in our unit tests.

### Component and HAL
Recall from our battery example that we had both `mock_battery.rs` and `virtual_battery.rs` and one simply called into the other.  We will maintain this same division because this represents where the HAL implementation to interface with actual hardware in a real-world context.  Here, of course, our `virtual_charger.rs` is not connected to any hardware and is pure code. But we still want to maintain the same level of separation.

Let's start by creating `virtual_charger.rs` and giving it this content:
```rust
// src/virtual_charger.rs

use embedded_batteries_async::charger::{MilliAmps, MilliVolts};

pub const MAXIMUM_ALLOWED_CURRENT:u16 = 3000;
pub const MAXIMUM_ALLOWED_VOLTAGE:u16 = 15000;


#[derive(Debug, Default)]
pub struct VirtualChargerState {
    current: MilliAmps,
    voltage: MilliVolts,
}

impl VirtualChargerState {
    pub fn new() -> Self {
        Self {
            current: 0,
            voltage: 0,
        }
    }
    pub fn set_current(&mut self, requested_current:MilliAmps) -> MilliAmps {
        if requested_current <= MAXIMUM_ALLOWED_CURRENT {
            self.current = requested_current;    
        }
        self.current
    }
    pub fn set_voltage(&mut self, requested_voltage:MilliVolts) -> MilliVolts {
        if requested_voltage <= MAXIMUM_ALLOWED_VOLTAGE {
            self.voltage = requested_voltage;
        }
        self.voltage
    }
    pub fn current(&self) -> MilliAmps {
        self.current
    }
    pub fn voltage(&self) -> MilliVolts {
        self.voltage
    }
}
```
This is pretty self explanatory - We simply maintain the last successfully requested values for `current` and `voltage`, which are assumed to be available as long as they are less than our specified MAXIMUM values per our simplistic model.

We are going to need the `mutex.rs` helper we had created for battery here, also.  Copy that file over from the battery project or create a new one here with this content:
```rust
// src/mutex.rs

#[cfg(test)]
pub use embassy_sync::blocking_mutex::raw::NoopRawMutex as RawMutex;

#[cfg(not(test))]
pub use embassy_sync::blocking_mutex::raw::ThreadModeRawMutex as RawMutex;

// Common export regardless of test or target
pub use embassy_sync::mutex::Mutex;
```

Now all we need to do is to echo the handling of the virtual charger actions via the Charger traits implemented by `mock_charger.rs` by giving it this content:
```rust

use embedded_batteries_async::charger::{
    Charger, Error, ErrorType, ErrorKind
};
pub use embedded_batteries::{MilliAmps, MilliVolts};
use crate::virtual_charger::VirtualChargerState;
use crate::mutex::{Mutex, RawMutex};

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
    pub state: Mutex<RawMutex, VirtualChargerState>,
}

impl MockCharger {
    pub fn new() -> Self {
        Self {
            state: Mutex::new(VirtualChargerState::new())
        }
    }
}

impl ErrorType for MockCharger {
    type Error = MockChargerError;
}

#[allow(refining_impl_trait)]
impl Charger for MockCharger {

    fn charging_current(&mut self, requested_current: MilliAmps) -> impl Future<Output = Result<MilliAmps, Self::Error>> {
        let state = &self.state;
        async move {
            let mut lock = state.lock().await;
            let val = lock.set_current(requested_current);
            Ok(val)
        }
    }

    fn charging_voltage(&mut self, requested_voltage: MilliVolts) -> impl Future<Output = Result<MilliVolts, Self::Error>> {
        let state = &self.state;
        async move {
            let mut lock = state.lock().await;
            let val = lock.set_voltage(requested_voltage);
            Ok(val)
        }
    }
}
```
You will recognize from the Battery exercise the pattern of using `impl Future<Output = Result<>>` as the return type for a fn that serves as an async trait, and completing the implementation by utilizing `async move {}`  This is just a "de-sugared" way of implementing an async trait.  Future versions of `Rust` may support an `async` trait by keyword, but this is a portable pattern that will work in any event.

#### Add to `lib.rs`
We need to add these to our `lib.rs` in order to compile, 
```rust
pub mod mock_charger;
pub mod virtual_charger;
pub mod mutex;
```

You should be able to do a clean build at this point.




