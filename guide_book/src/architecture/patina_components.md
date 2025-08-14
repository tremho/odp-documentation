# Patina Components

Patina components are built according to Traits and introduced via Dependency Injection (DI) into the Patina framework. This allows for a modular and reusable design that can be easily adapted to different platforms and configurations.

## Component Development

Please refer to the [Patina documentation]() for more details, but the basic pseudo-code steps for creating a component are actually pretty simple:

```rust
use log::info;
use patina_sdk::{component::params::Config, error::Result};

#[derive(Default, Clone, Copy)]
pub struct Name(pub &'static str);

pub fn run_test_component(name: Config<Name>) -> Result<()> {
    info!("============= Test Component ===============");
    info!("Hello, {}!", name.0);
    info!("=========================================");
    Ok(())
}
```
One creates a component as a function with parameters that implement the required traits (in this case the Config<Name> trait). The function can then be registered with the Patina framework, which will handle the dependency injection and execution of the component.  

```rust
Core::default()
    .with_component(test_component::run_test_component)
    .with_config(test_component::Name("World"))
    .start()
```

What the component actually does is up to the developer, but the structure remains consistent. The component can be as simple or complex as needed, and it can interact with other components through the Patina framework's messaging system.


Refer to Patina's [component model documentation](https://github.com/OpenDevicePartnership/patina/blob/728c7e3a345a0a74351b14c1ff9a6bf948248fed/docs/src/dxe_core/component_model.md)
and the Patina [dispatcher documentation](https://github.com/OpenDevicePartnership/patina/blob/728c7e3a345a0a74351b14c1ff9a6bf948248fed/docs/src/dxe_core/dispatcher.md)
for official details on the component model and how to implement components in Patina.
