# Integration

Before we turn our attention to making an embedded build to a hardware target, we want to make sure that we have a working integration of the 
components in a virtual environment. This will allow us to test the interactions between the components and ensure that they work together as expected before we move on to the embedded build.

In this section, we will cover the integration of all of our example components working together. 
This integration will be similar to the previous examples, but with some additional complexity due to the interaction between the components. We will also explore how to test the integration of these components and ensure that they work together as expected.

## A simulation
We will build this integration as both an integration test and as an executable app that runs the simulation of the components in action. This simulator will allows us to increase/decrease the load, mimicking the behavior of a real system, and we can then observe how the components interact with each other to keep the battery charged and the system cool over differing operating conditions.

## Starting with comms

We will start by building the communication layer that will allow the components to interact with each other. This will involve setting up the message passing system that will allow the components to send and receive messages, as well as setting up the service registry that will allow the components to discover each other.

We've done much of this before.  If you will recall the Battery and Charger integration tests, we extended the `EspiService` structure from supporting a single BatteryChannel to supporting a ChargerChannel as well.  Now we will extend it further to support a ThermalChannel. 

### Setting up the integration project
We will create a new project space for this integration, rather than trying to shoehorn it into the existing battery or charger projects. This will allow us to keep the integration code separate from the component code, making it easier to manage and test.

Create a new project directory in the `ec_examples` directory named `integration_project`.  Give it a `Cargo.toml` file with the following content:

```toml
# Battery-Charger Subsystem 
[package] 
name = "integration_project"
version = "0.1.0"
edition = "2024"
resolver = "2"
description = "System-level integration sim wiring Battery, Charger, and Thermal"


# We'll declare both a lib (for tests) and a bin (for the simulator)
[lib]
name = "integration_project"
path = "src/lib.rs"

[[bin]]
name = "integration_sim"
path = "src/main.rs"


[dependencies]
embedded-batteries-async    = { workspace = true }
embassy-executor            = { workspace = true }
embassy-time                = { workspace = true }
embassy-sync                = { workspace = true }
embassy-futures             = { workspace = true }
embassy-time-driver         = { workspace = true }
embassy-time-queue-utils    = { workspace = true }

embedded-services           = { workspace = true }
battery-service             = { workspace = true }

ec_common       = { path = "../ec_common"}
mock_battery    = { path = "../battery_project/mock_battery", default-features = false}
mock_charger    = { path = "../charger_project/mock_charger", default-features = false}
mock_thermal    = { path = "../thermal_project/mock_thermal", default-features = false}

# Logging for the simulator
log         = { version = "0.4", optional = true }
env_logger  = { version = "0.11", optional = true }

static_cell = "2.1"
futures     = "0.3"
heapless    = "0.8"

[features]
default = ["std", "thread-mode"]
std =  []
thread-mode = [
    "mock_battery/thread-mode",
    "mock_charger/thread-mode",
    "mock_thermal/thread-mode"
]
noop-mode = [
    "mock_battery/noop-mode",
    "mock_charger/noop-mode",
    "mock_thermal/noop-mode"
]
```

Next, edit the `ec_examples/Cargo.toml` at the top level to add `integration_project` as a workspace member:

```toml
 members = [
    "battery_project/mock_battery",
    "charger_project/mock_charger",
    "thermal_project/mock_thermal",
    "battery_charger_subsystem",
    "integration_project",
    "ec_common"
]
```

