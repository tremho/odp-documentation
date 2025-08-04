# Attach to Controller

We have our simple _virtual charger_ ready as a component.  To complete wiring it in as a `Device` that can be driven by a registered `Controller` is our next step.

Create `mock_charger_device.rs` and give it this content:
```rust

use embedded_services::power::policy::DeviceId;
use embedded_services::power::policy::action::device::AnyState;
use embedded_services::power::policy::device::{
    Device, DeviceContainer, CommandData, ResponseData
};
use crate::mock_charger::MockCharger;


pub struct MockChargerDevice {
    charger: MockCharger,
    device: Device,
}

impl MockChargerDevice {
    pub fn new(id: DeviceId) -> Self {
    Self {
            charger: MockCharger::new(),
            device: Device::new(id)
        }
    }

    pub fn get_internals(&mut self) -> (
        &mut MockCharger,
        &mut Device,
    ) {
        (
            &mut self.charger,
            &mut self.device
        )
    }

    pub fn device(&self) -> &Device {
        &self.device
    }

    pub fn inner_charger(&mut self) -> &mut MockCharger {
        &mut self.charger
    }   

    pub async fn run(&self) {
        loop {
            let cmd = self.device.receive().await;

            // Access command using the correct method
            let request = &cmd.command; 

            match request {
                CommandData::ConnectAsConsumer(cap) => {
                    println!("Received ConnectConsumer for {}mA @ {}mV", cap.capability.current_ma, cap.capability.voltage_mv);

                    // Safe placeholder: detach any existing state
                    match self.device.device_action().await {
                        AnyState::ConnectedProvider(dev) => {
                            if let Err(e) = dev.detach().await {
                                println!("Detach failed: {:?}", e);
                            }
                        }
                        AnyState::ConnectedConsumer(dev) => {
                            if let Err(e) = dev.detach().await {
                                println!("Detach failed: {:?}", e);
                            }
                        }
                        _ => (),
                    }

                    cmd.respond(Ok(ResponseData::Complete));
                }

                CommandData::ConnectAsProvider(cap) => {
                    println!("Received ConnectProvider for {}mA @ {}mV", cap.capability.current_ma, cap.capability.voltage_mv);

                    match self.device.device_action().await {
                        AnyState::ConnectedProvider(dev) => {
                            if let Err(e) = dev.detach().await {
                                println!("Detach failed: {:?}", e);
                            }
                        }
                        AnyState::ConnectedConsumer(dev) => {
                            if let Err(e) = dev.detach().await {
                                println!("Detach failed: {:?}", e);
                            }
                        }
                        _ => (),
                    }

                    cmd.respond(Ok(ResponseData::Complete));
                }

                CommandData::Disconnect => {
                    println!("Received Disconnect");

                    match self.device.device_action().await {
                        AnyState::ConnectedProvider(dev) => {
                            if let Err(e) = dev.detach().await {
                                println!("Detach failed: {:?}", e);
                            }
                        }
                        AnyState::ConnectedConsumer(dev) => {
                            if let Err(e) = dev.detach().await {
                                println!("Detach failed: {:?}", e);
                            }
                        }
                        _ => {
                            println!("Already disconnected or idle");
                        }
                    }

                    cmd.respond(Ok(ResponseData::Complete));
                }
            }
        }
    }
}

impl DeviceContainer for MockChargerDevice {
    fn get_power_policy_device(&self) -> &Device {
        &self.device
    }
}
```
If you recall the `MockBatteryDevice` you will note that this is nearly identical and it serves the same purpose, but for the charger.

#### Add to `lib.rs`
```rust
pub mod mock_charger;
pub mod virtual_charger;
pub mod mutex;
pub mod mock_charger_device;
```

Now that we have a `MockChargerDevice` we can construct our `Controller`

We can find the trait expectations for a charger Controller in `embedded_service::power::policy::charger` where `ChargeController` gives us the traits to implement.

Our Controller will listen to policy manager events and conduct the appropriate actions. 

Create a new file named `mock_charger_controller.rs` and start it off like this:
```rust
use crate::mock_charger::{MockCharger, MockChargerError, MilliAmps, MilliVolts};
use crate::mock_charger_device::MockChargerDevice;
use embedded_batteries_async::charger::{Charger, ErrorType};
use embedded_services::power::policy::charger::{
    ChargeController, ChargerEvent, ChargerError, PsuState, State
};
use embedded_services::power::policy::PowerCapability;

pub struct MockChargerController {
    #[allow(unused)]
    charger: &'static mut MockCharger,
    pub device: &'static mut MockChargerDevice
}

impl MockChargerController
{    
    pub fn new(charger:&'static mut MockCharger, device: &'static mut MockChargerDevice) -> Self {
        Self { charger, device }
    }
}

impl ErrorType for MockChargerController 
{
    type Error = MockChargerError;
}

impl Charger for MockChargerController
{
    fn charging_current(
        &mut self,
        requested_current: MilliAmps,
    ) -> impl core::future::Future<Output = Result<MilliAmps, Self::Error>> {
        let charger: &mut MockCharger = self.device.inner_charger();
        charger.charging_current(requested_current)
    }

    fn charging_voltage(
        &mut self,
        requested_voltage: MilliVolts,
    ) -> impl core::future::Future<Output = Result<MilliVolts, Self::Error>> {
        let charger: &mut MockCharger = self.device.inner_charger();
        charger.charging_voltage(requested_voltage)
    }
}

impl ChargeController for MockChargerController 
{
    type ChargeControllerError = ChargerError;

    fn wait_event(&mut self) -> impl core::future::Future<Output = ChargerEvent> {
        async move { ChargerEvent::Initialized(PsuState::Attached) }
    }

    fn init_charger(
        &mut self,
    ) -> impl core::future::Future<Output = Result<(), Self::ChargeControllerError>> {
        async move {
            println!("🛠️  Charger initialized.");
            Ok(())
        }
    }

    fn is_psu_attached(
        &mut self,
    ) -> impl core::future::Future<Output = Result<bool, Self::ChargeControllerError>> {
        async move {
            println!("🔌 Simulating PSU attached check...");
            Ok(true)
        }
    }

    fn attach_handler(
        &mut self,
        capability: PowerCapability,
    ) -> impl core::future::Future<Output = Result<(), Self::ChargeControllerError>> {
        let requested_current = capability.current_ma;
        let requested_voltage = capability.voltage_mv;
        let controller = self;

        async move {
            println!(
                "⚡ Charger attach requested: {} mA @ {} mV",
                requested_current, requested_voltage
            );

            let sup_cur = controller.charging_current(requested_current).await.unwrap();
            let sup_volt = controller.charging_voltage(requested_voltage).await.unwrap();

            if sup_cur != requested_current || sup_volt != requested_voltage {
                println!("⚠️ Controller refused requested values: got {} mA @ {} mV", sup_cur, sup_volt);
                return Err(ChargerError::InvalidState(crate::mock_charger_controller::State::Unpowered));
            }           

            println!("⚡ values supplied: {} mA @ {} mV", sup_cur, sup_volt);

            Ok(())
        }
    }

    fn detach_handler(
        &mut self,
    ) -> impl core::future::Future<Output = Result<(), Self::ChargeControllerError>> {
        let controller = self;

        async move {
            let _ = controller.charging_current(0).await.unwrap();
            let _ = controller.charging_voltage(0).await.unwrap();
            println!("🔌 Charger detached.");
            Ok(())
        }
    }

    fn is_ready(
        &mut self,
    ) -> impl core::future::Future<Output = Result<(), Self::ChargeControllerError>> {
        async move {
            println!("✅ Charger is ready.");
            Ok(())
        }
    }
}

```
This pattern should look familiar to that of the Battery example in that we implement the `Charger` traits as well as the `ChargeController` traits.  The handling of the `Charger` traits is delegated to the attached `MockCharger`.

The `ChargeController` handle charger attachment / detachment in response to a policy decision and event.

Add to `lib.rs`:
```rust
pub mod mock_charger_controller;
``` 



Next we will write some tests to check out our new Charger.

