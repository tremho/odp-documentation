# Battery Service Preparation


---------------
_TODO: 
This section needs to be revisited and rewritten to support a successful 'standard' build - earlier attempts at 
including some of the dependencies in a std environment failed, and so this was written to build for the embedded target
at this premature phase.  We want to build the battery complete before switching to the embedded context though._

-----------------

We've successfully exposed and proven our implementation of battery traits and their values for our mock battery,
and built for an embedded target.
In this step, we'll continue our integration by connecting to a battery service, but that requires some setup to cover first.

## Battery-service
The ODP repository `embedded-services` has the `battery-service` we need for this, as well as the power-policy infracture support that uses it.

The ODP repository `embedded-cfu` is also needed here,
as is `embedded-usb-pd`.

We will bring these into our scope now.

In the `battery_project`, we'll bring these in with the commands:

```
git submodule add https://github.com/OpenDevicePartnership/embedded-services

git submodule add git@github.com:OpenDevicePartnership/embedded-cfu

git submodule add git@github.com:OpenDevicePartnership/embedded-usb-pd

```


### A Mock Battery Device
To fit the design of the ODP battery service, we first need to create a wrapper that contains our MockBattery and a Device Trait.  We need to implement `DeviceContainer` for this wrapper and reference that `Device`.
Then we will register the wrapper with `register_device(...)` and we will have an async loop that awaits commands on the `Device`'s `channel`, executes them, and updates state.

#### Import the battery-service from the ODP crate
One of the service definitions from the `embedded-services` repository we brought into scope is the `battery-service`. 
We now need to update our Cargo.toml to know where to find it.
Open the `Cargo.toml` file of your mock-battery project and add the dependency to the battery-service path to our Cargo.toml.  We will also need a reference to `embedded-services` itself for various support needs.  Update your `mock_battery/Cargo.toml` so that your `[dependencies]` section now looks like this:

```
[dependencies]
cortex-m-rt = "0.7.3"
static_cell = "2.0.0"
embedded-batteries = { path = "../embedded-batteries/embedded-batteries" }
embedded-batteries-async = { path = "../embedded-batteries/embedded-batteries-async" }
battery-service = { path = "../embedded-services/battery-service" }
embedded-services = { path = "../embedded-services/embedded-service" }
embedded-cfu = { path = "../embedded-cfu}
```
This will allow us to import what we need for the next steps.

### Define the MockBatteryDevice wrapper

In your mock_battery project `src` folder, create a new file named `mock_battery_device.rs` and give it this content:

```rust
use crate::mock_battery::MockBattery;
use embedded_services::power::policy::DeviceId;
use embedded_services::power::policy::action::device::AnyState;
use embedded_services::power::policy::device::{
    Device, DeviceContainer, CommandData, ResponseData//, State
};


pub struct MockBatteryDevice {
    #[allow(dead_code)] // Prevent unused warning for MockBattery -- not used yet   
    battery: MockBattery,
    device: Device,
}

impl MockBatteryDevice {
    pub fn new(id: DeviceId) -> Self {
    Self {
            battery: MockBattery,
            device: Device::new(id)
        }
    }

    pub fn device(&self) -> &Device {
        &self.device
    }

    pub async fn run(&self) {
        loop {
            let cmd = self.device.receive().await;

            // Access command using the correct method
            let request = &cmd.command; 

            match request {
                CommandData::ConnectAsConsumer(cap) => {
                    println!("Received ConnectConsumer for {}mA @ {}mV", cap.current_ma, cap.voltage_mv);

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
                    println!("Received ConnectProvider for {}mA @ {}mV", cap.current_ma, cap.voltage_mv);

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

impl DeviceContainer for MockBatteryDevice {
    fn get_power_policy_device(&self) -> &Device {
        &self.device
    }
}
```
What we've done here is:

- Imported what we need from the ODP repositories for both the SmartBattery definition from `embedded-batteries` and the battery service components from `embedded-services` crates as as our own local MockBattery definition.

- Defined and implemented our MockBatteryDevice
- implemented a run loop for our MockBatteryDevice

Note we have some `println!` statements here to echo when certain events occur.  These won't be seen until later, but we want feedback when we do hook things up in our pre-test example.

#### Including mock_battery_device
Just like we had to inform the build of our mock_battery, we need to do likewise with mock_battery_device.  So edit `lib.rs` and to this:
```rust
pub mod mock_battery;
pub mod mock_battery_device;
```

After you've done all that,  you should be able to build with 
```
cargo build
```
and get a clean result

Next we will work to put this battery to use.

