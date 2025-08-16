# A Mock Thermal Subsystem Project

We will follow the pattern we established for the battery and charger -- in their post-integration-refactored form.  That is, we will create a standalone project space for thermal work, but within the shared scope of the common dependencies that we can use later for integration work.

Starting from the shared directory used for the previous integration exercise (`ec_examples`), we will create the thermal project space:
```
cd ec_examples
mkdir thermal_project
cd thermal_project
cargo new --lib mock_thermal
```
Then, create `thermal_project/Cargo.toml`.


Some of the dependencies we need are already a part of the repositories already in place in our `ec_examples` containing folder, particularly within `embedded-services`.  The `thermal-service` is a sub-section of this repository.  To reference it directly,though, we will define it as `thermal-service` in our `Cargo.toml`.

Use this content for `thermal_project/Cargo.toml` to start:

```toml
# thermal_project/Cargo.toml
[workspace]
resolver = "2"
members = [
    "mock_thermal"
]

[workspace.lints]

[workspace.dependencies]
embedded-services = { path = "../embedded-services/embedded-service" }
battery-service = { path = "../embedded-services/battery-service" }
embedded-batteries = { path = "../embedded-batteries/embedded-batteries" }
embedded-batteries-async = { path = "../embedded-batteries/embedded-batteries-async" }
embedded-cfu-protocol = { path = "../embedded-cfu" }
embedded-usb-pd = { path = "../embedded-usb-pd" }

thermal-service = { path = "../embedded-services/thermal-service" } 
embedded-sensors-hal-async = { path = "../embedded-sensors/embedded-sensors-async"}
embedded-fans-async = { path = "../embedded-fans/embedded-fans-async"}

embassy-executor = { path = "../embassy/embassy-executor", features = ["arch-std", "executor-thread"], default-features = false }
embassy-time = { path = "../embassy/embassy-time" }
embassy-sync = { path = "../embassy/embassy-sync", features = ["std"] }
embassy-futures = { path = "../embassy/embassy-futures" }
embassy-time-driver = { path = "../embassy/embassy-time-driver" }
embedded-hal = "1.0"
embedded-hal-async = "1.0"
once_cell = "1.19"
static_cell = "2.1.0"
defmt = "1.0"
log = "0.4.27"
bitfield = "0.19.1"
bitflags = "1.0"
bitvec = "1.0"
cfg-if = "1.0"
chrono = "0.4.41"
tokio = { version = "1.45", features = ["full"] }
uuid = "1.0"
critical-section = {version = "1.0", features = ["std"] }
document-features = "0.2.11"
embedded-hal-nb = "1.0"
embedded-io = "0.6.1"
embedded-io-async = "0.6.1"
embedded-storage = "0.3.1"
embedded-storage-async = "0.4.1"
fixed = "1.0"
heapless = "0.8.0"
postcard = "1.0"
rand_core = "0.9.3"
serde = "1.0"
cortex-m = "0.7.7"
cortex-m-rt = "0.7.5"

[patch.crates-io]
embassy-executor = { path = "../embassy/embassy-executor" }
embassy-time = { path = "../embassy/embassy-time" }
embassy-sync = { path = "../embassy/embassy-sync" }
embassy-futures = { path = "../embassy/embassy-futures" }
embassy-time-driver = { path = "../embassy/embassy-time-driver" }
embedded-batteries-async = { path = "../embedded-batteries/embedded-batteries-async" }
}
```

Update the main workspace cargo at `ec_examples\Cargo.toml` to look like this:
```toml
# ec_examples/Cargo.toml
[workspace]
resolver = "2"
members = [
    "battery_project/mock_battery",
    "charger_project/mock_charger",
    "thermal_project/mock_thermal",
    "battery_charger_subsystem",
    "ec_common"
]

[workspace.dependencies]
embedded-services = { path = "embedded-services/embedded-service" }
battery-service = { path = "embedded-services/battery-service" }
embedded-batteries = { path = "embedded-batteries/embedded-batteries" }
embedded-batteries-async = { path = "embedded-batteries/embedded-batteries-async" }
embedded-cfu-protocol = { path = "embedded-cfu" }
embedded-usb-pd = { path = "embedded-usb-pd" }

thermal-service = { path = "embedded-services/thermal-service" } 
embedded-sensors-hal-async = { path = "embedded-sensors/embedded-sensors-async"}
embedded-fans-async = { path = "embedded-fans/embedded-fans-async"}

embassy-executor = { path = "embassy/embassy-executor", features = ["arch-std", "executor-thread"], default-features = false }
embassy-time = { path = "embassy/embassy-time", features=["std"], default-features = false }
embassy-sync = { path = "embassy/embassy-sync", features = ["std"] }
embassy-futures = { path = "embassy/embassy-futures" }
embassy-time-driver = { path = "embassy/embassy-time-driver", default-features = false}
embassy-time-queue-utils = { path = "embassy/embassy-time-queue-utils" }
embedded-hal = "1.0"
embedded-hal-async = "1.0"
once_cell = "1.19"
static_cell = "2.1.0"
defmt = "1.0"
log = "0.4.27"
bitfield = "0.19.1"
bitflags = "1.0"
bitvec = "1.0"
cfg-if = "1.0"
chrono = "0.4.41"
tokio = { version = "1.45", features = ["full"] }
uuid = "1.0"
critical-section = {version = "1.0", features = ["std"] }
document-features = "0.2.11"
embedded-hal-nb = "1.0"
embedded-io = "0.6.1"
embedded-io-async = "0.6.1"
embedded-storage = "0.3.1"
embedded-storage-async = "0.4.1"
fixed = "1.0"
heapless = "0.8.0"
postcard = "1.0"
rand_core = "0.9.3"
serde = "1.0"
cortex-m = "0.7.7"
cortex-m-rt = "0.7.5"

[patch.crates-io]
embassy-executor = { path = "embassy/embassy-executor" }
embassy-time = { path = "embassy/embassy-time" }
embassy-sync = { path = "embassy/embassy-sync" }
embassy-futures = { path = "embassy/embassy-futures" }
embassy-time-driver = { path = "embassy/embassy-time-driver" }
embassy-time-queue-utils = { path = "embassy/embassy-time-queue-utils" }
embedded-batteries-async = { path = "embedded-batteries/embedded-batteries-async" }

# Lint settings for the entire workspace.
# We start with basic warning visibility, especially for upcoming Rust changes.
# Additional lints are listed here but disabled by default, since enabling them
# may trigger warnings in upstream submodules like `embedded-services`.
#
# To tighten enforcement over time, you can uncomment these as needed.
[workspace.lints.rust]
warnings = "warn"              # Show warnings, but do not fail the build
future_incompatible = "warn"  # Highlight upcoming breakage (future Rust versions)
# rust_2018_idioms = "warn"     # Enforce idiomatic Rust style (may warn on legacy code)
# unused_crate_dependencies = "warn"  # Detect unused deps — useful during cleanup
# missing_docs = "warn"       # Require documentation for all public items
# unsafe_code = "deny"        # Forbid use of `unsafe` entirely

[patch.'https://github.com/embassy-rs/embassy']
embassy-time = { path = "./embassy/embassy-time" }
embassy-time-driver = { path = "./embassy/embassy-time-driver" }
embassy-sync = { path = "./embassy/embassy-sync" }
embassy-executor = { path = "./embassy/embassy-executor" }
embassy-futures = { path = "./embassy/embassy-futures" }
```

### Including `embedded-sensors` and `embedded-fans`
We need to add another pair of repository dependencies to our existing set at `ec_examples`.  From the `ec_examples` folder,
bring in the `embedded-sensors` and the `embedded-fans` repository like so:

```
git clone git@github.com:OpenDevicePartnership/embedded-sensors.git
git clone git@github.com:OpenDevicePartnership/embedded-fans.git
```


### Pre-Testing the project configuration
from the `ec_examples/thermal_project` folder typing
```
cargo build
```
and from the `ec_examples` folder, typing
```
cargo build -p mock_thermal
```
Should both build successfully.  This means the `Cargo.toml` files are in the correct relationship.

(_Note: The `thermal_project/Cargo.toml` workspace configuration is somewhat redundant, but necessary to be consistent with the way the battery and charger projects were originally established._)


