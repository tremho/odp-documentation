# Charger example project
The charger component is a separate component and will be built into it's own project space.
This project space will be very similar to the `battery_project` space we just completed.

In this project we will:
- Establish the project space
- Bring in the dependent repositories as submodules, similar to what we had done in Battery
- Set up our `Cargo.toml` files similar to what we had done in Battery
- Implement the Traits required by our Charger component in a virtual HAL-substitute
- Wire up the component subsystem with a `Device` and a `Controller`
- Supply and conduct unit testing on the finished component.

## Establish the project space
Like we did for Battery, we'll want to create a project directory (probably alongside your existing `battery_project`).  Name this one `charger_project`.

```
mkdir charger_project
cd charger_project
git init
```
This will create a workspace root for us and establish it as a git repository (not attached).

Now, we are going to bring the repositories we will be dependent upon into our workspace as submodules.  
Just as in the Battery example, we will be using `embedded-services` and also `embedded-batteries`.  We also need `embassy` as well.

Just like as in the battery example, we also need references to `embedded-cfu` and `embedded-ub-pd` to satisfy the workspace dependencies upstream.

_(from the `charger_project` directory):_
```
git submodule add https://github.com/OpenDevicePartnership/embedded-batteries
git submodule add https://github.com/OpenDevicePartnership/embedded-services
git submodule add https://github.com/OpenDevicePartnership/embedded-cfu
git submodule add https://github.com/OpenDevicePartnership/embedded-usb-pd
git submodule add https://github.com/embassy-rs/embassy.git 
```

And we then want to create the following project structure within the `charger_project` directory:

```
mock_charger \
    src \
      - mock_charger.rs  
      - lib.rs
    Cargo.toml
Cargo.toml
```
So, once again, there is a top-level `Cargo.toml` file found  in the `charger_project` folder itself.  
Then within this root folder there the component project folder (`mock_charger`) which also contains a `Cargo.toml` and a `src` folder.  We'll populate the `src` folder with just empty `lib.rs` and `mock_charger.rs` files for now.

We'll make the top-level `Cargo.toml` the same as the one we ended up with for Battery, since we are using the same dependency chains here:
```toml
[workspace]
resolver = "2"
members = [
    "mock_charger"
]

[workspace.dependencies]
embassy-executor = { path = "embassy/embassy-executor", features = ["arch-std", "executor-thread"], default-features = false }
embassy-time = { path = "embassy/embassy-time" }
embassy-sync = { path = "embassy/embassy-sync", features = ["std"] }
embassy-futures = { path = "embassy/embassy-futures" }
embassy-time-driver = { path = "embassy/embassy-time-driver" }
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
embedded-batteries = { path = "embedded-batteries/embedded-batteries" }
embedded-batteries-async = { path = "embedded-batteries/embedded-batteries-async" }
embedded-services = { path = "embedded-services/embedded-service" }
battery-service = { path = "embedded-services/battery-service" }
embedded-cfu-protocol = { path = "embedded-cfu" }
embedded-usb-pd = { path = "embedded-usb-pd" }

[patch.crates-io]
embassy-executor = { path = "embassy/embassy-executor" }
embassy-time = { path = "embassy/embassy-time" }
embassy-sync = { path = "embassy/embassy-sync" }
embassy-futures = { path = "embassy/embassy-futures" }
embassy-time-driver = { path = "embassy/embassy-time-driver" }
embassy-time-queue-utils = { path = "embassy/embassy-time-queue-utils" }

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
```

and similarly, for the `mock_charger/Cargo.toml` we can borrow from the Battery case as well:
```toml
[package]
name = "mock_charger"
version = "0.1.0"
edition = "2024"

[dependencies]
embedded-batteries-async = { path = "../embedded-batteries/embedded-batteries-async" }
embedded-batteries = { path = "../embedded-batteries/embedded-batteries" }
battery-service = { path = "../embedded-services/battery-service" }
embedded-services = { path = "../embedded-services/embedded-service" }
embassy-executor = { workspace = true }
embassy-time = { workspace = true, features=["std"] }
embassy-sync = { workspace = true }
critical-section = {version = "1.0", features = ["std"] }
async-trait = "0.1"
tokio = { workspace = true }
static_cell = "1.0"
once_cell = { workspace = true }

[dev-dependencies]
embassy-executor = { workspace = true, features = ["arch-std"] }
```
That should set us up for what we will encounter in the course of implementing the charger component.






