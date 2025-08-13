# Integration testing Battery and Charger behavior
Now that both our `MockBattery` and our `MockCharger` have unit tests that test their features individually, we turn our
attention to _Integration Tests_.

## Integration Tests
Integration tests differ from unit tests:
- The tests are primarily designed to test the behavior of one or more system components _in-situ_.
- The test code maintained separate from the code being tested.

### How rust runs tests vs code
Rust defines specific convention for organizing and running code in a project.
By default, code in the `src` directory is considered to be the location that `build` and `run` commands target, and
`test` will run this same code, but gated by the `test` configuration.  This is why we can put unit tests in the same files
as their code sources and have it compiled for execution by the test runner.

We can also put test files in a directory named `tests` and these will also execute by default under a test runner.  However,
files in this location are not compiled with a `#[cfg(test)]` gate in effect, since they are intended only for testing anyway.

Another "special" location for Rust is `src/bin`.  Files in this location can each have their own separate `main()` function and operate as independent executions when targeted by the `run` command.

### How we will set up our integration test.
You may recall that the battery example's `main()` function invokes `embassy-executor` to spawn a series of asynchronous tasks, because this reflects how the code is meant to operate in an integrated embedded environment.  You will also recall the use of our `test_helper.rs` in both the battery and the charger examples to give us essentially the same async model for testing.

We will be using a similar technique for this combined integration, in a way that serves the goals of an integration test.  

Accordingly, we will not be using the `test` features of Rust, but rather creating a normal runnable program to execute the testing behaviors.  

Often, integration tests can be implemented as another variation of unit tests, and placed in the `tests` directory where the test runner of `cargo test` will find them and execute them, and report on the results, along with the unit tests.

But we will choose to not use this method, and just run our tests with `cargo run` because as we've already seen the async nature of our code undermines the usefulness of each `#[test]` block. We want each of our tasks to be independently observable.  To do that we will be creating a `TestObserver` for reporting our pass/fail results.

#### But where?
We will create a new project space for this.  Alongside your `battery_project` and `charger_project` directories, create a new one named `battery_charger_subsystem`.  Go ahead and populate the new project with some starting files (these can be empty at first), so that your setup looks something like this:
```
ec_examples/
├── battery_project/
├── charger_project/
├── battery_charger_subsystem/
│   ├── src/
│   │   ├── lib.rs
│   │   ├── main.rs
│   │   ├── policy.rs       
│   │   ├── test_observer.rs
│   └── Cargo.toml
```

You can construct the `battery_charger_subsystem` structure with these commands from a `cmd` prompt

(from within the top-level container folder):
```cmd
mkdir battery_charger_subsystem
cd battery_charger_subsystem
echo '# Battery-Charger Subsystem' > Cargo.toml
mkdir src
cd src
echo // lib.rs > lib.rs
echo // main.rs > main.rs 
echo // test_observer.rs > test_observer.rs
cd ../.. 
```

## ☙ A note on dependency structuring ☙
Up to this point we've been treating each component project as a standalone effort, and in that respect all of the dependent repositories are brought in as submodules _within_ each project.  For battery and charger, these dependencies are nearly identical.
In retrospect, it would probably have been better to place these dependencies outside of the component project spaces so they could share the same resources. That would have been especially helpful now that we are here at integration.

In fact, it becomes _imperative_ that we remedy this structure before we continue to insure all the components in question and the test code itself are relying on the same versions of the dependent code. Even a minor version mismatch -- although harmless at runtime -- may halt compilation if Rust detects drift.

## ⚠️⚒ Refactoring detour ⚒⚠️
We need to bite the bullet and remedy this before we continue.  It won't take too long, and once these changes are complete ou should be able to build all the components and proceed with the integration confidently.

First, identify the containing folder you have your `battery_project` and `charger_project` files in.
We are going to turn this folder into an unattached `git` folder the same way we did for the projects and bring the submodules in at this level.  If your containing folder is not appropriate for this, create a new folder (perhaps `ec_examples`) and move your project folders into here before continuing.

Now, in the containing folder (`ec_examples`), perform the following:
```
git init
git submodule add https://github.com/embassy-rs/embassy.git 
git submodule add https://github.com/OpenDevicePartnership/embedded-batteries
git submodule add https://github.com/OpenDevicePartnership/embedded-services
git submodule add https://github.com/OpenDevicePartnership/embedded-cfu
git submodule add https://github.com/OpenDevicePartnership/embedded-usb-pd
```

now, go into your battery_project and at the root of this project, execute these commands to remove its internal submodules:
```cmd
git submodule deinit -f embassy
git rm -f embassy
git submodule deinit -f embedded-batteries
git rm -f embedded-batteries
git submodule deinit -f embedded-services
git rm -f embedded-services
git submodule deinit -f embedded-cfu
git rm -f embedded-cfu
git submodule deinit -f embedded-usb-pd
git rm -f embedded-usb-pd
```
Now in both your `battery_project/Cargo.toml` and your `battery_project/mock_battery/Cargo.toml` change all path references to `embassy`, or `embedded-`anything by prepending a `../` to their path.  This will point these to our new location in the container.

> 📦 **Dependency Overrides**
>
> Because some crates (like `battery-service`) pull in Embassy as a Git dependency, while we use a local path-based submodule, we must unify them using a `[patch]` section in our `Cargo.toml`.
>
> This ensures all parts of our build use the *same single copy* of Embassy, which is critical to avoid native-linking conflicts like `embassy-time-driver`.

Add this to the bottom of your top-level `Cargo.toml` (`battery_project/Cargo.toml`):
```toml
[patch.'https://github.com/embassy-rs/embassy']
embassy-time = { path = "../embassy/embassy-time" }
embassy-time-driver = { path = "../embassy/embassy-time-driver" }
embassy-sync = { path = "../embassy/embassy-sync" }
embassy-executor = { path = "../embassy/embassy-executor" }
embassy-futures = { path = "../embassy/embassy-futures" }
```

and add this line to the bottom of your `[patch.crates-io]` section
```toml
embedded-batteries-async = { path = "../embedded-batteries/embedded-batteries-async" }
```

Now, still in `battery_project` insure you can still build with `cargo clean` and `cargo build`

### Do the same for charger_project
We want to follow the exact same steps for the charger project:
- switch to that project directory (`charger_project`)
- Execute the same submodule removal commands we used for the battery_project
- Prepend `../` to all the path names for `embassy` and `embedded-`* in the `Cargo.toml` files
- add the `[patch.'https://github.com/embassy-rs/embassy']` section from above to the top-level `Cargo.toml`
- add the `embedded-batteries-async` fixup line to the `[path.crates.io]` as we did above.

Ensure `charger_project` builds clean in its new form.


### ♻ Common files and new dependencies
When we did the battery and charger work, we created a number of general helper files and copied these between projects. Our integration project is going to need some of these same files also, so it makes sense that while we are doing this refactor we also
address common files that will be used between them.

This also will introduce new wrinkles to the dependencies between projects, so we need to revisit our `Cargo.toml` chains again.

Create a folder named `ec_common` within your containing folder do that is a sibling to your other project folders and the dependencies.

Create a `Cargo.toml` file for this folder. Give it this content:
```toml
# ec_common/Cargo.toml
[package]
name = "ec_common"
version = "0.1.0"
edition = "2024"

[dependencies]
# Embassy
embassy-executor = { path = "../embassy/embassy-executor", features = ["arch-std", "executor-thread"], default-features = false }
embassy-time = { path = "../embassy/embassy-time" }
embassy-sync = { path = "../embassy/embassy-sync", features = ["std"] }
battery-service = { path = "../embedded-services/battery-service" }
embedded-services = { path = "../embedded-services/embedded-service" }

# Static allocation helpers
static_cell = "1.2"

[features]
default = []
thread-mode = []
noop-mode = []
```

We also need a new toml at the top level (`ec_examples`).  Create a `Cargo.toml` file here and give it this:
```toml
# ec_examples/Cargo.toml
[workspace]
resolver = "2"
members = [
    "battery_project/mock_battery",
    "charger_project/mock_charger",
    "battery_charger_subsystem",
    "ec_common"
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

You may recognize much of this as what was in our workspace `Cargo.toml` files for the battery and charger projects.  Those workspaces are still valid in local scope, but this gives us the same associations across the full integration.

We need to update the existing toml files for the subprojects also. Please replace the following toml files with this new content:

```toml
# battery_project/Cargo.toml
[workspace]
resolver = "2"
members = [
    "mock_battery"
]

[workspace.dependencies]
ec_common = { path = "../ec_common" }
embassy-executor = { path = "../embassy/embassy-executor", features = ["arch-std", "executor-thread"], default-features = false }
embassy-time = { path = "../embassy/embassy-time" }
embassy-sync = { path = "../embassy/embassy-sync", features = ["std"] }
embassy-futures = { path = "../embassy/embassy-futures" }
embassy-time-driver = { path = "../embassy/embassy-time-driver" }
embassy-time-queue-utils = { path = "../embassy/embassy-time-queue-utils" }
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
embedded-batteries = { path = "../embedded-batteries/embedded-batteries" }
embedded-batteries-async = { path = "../embedded-batteries/embedded-batteries-async" }
embedded-services = { path = "../embedded-services/embedded-service" }
battery-service = { path = "../embedded-services/battery-service" }
embedded-cfu-protocol = { path = "../embedded-cfu" }
embedded-usb-pd = { path = "../embedded-usb-pd" }

[patch.crates-io]
embassy-executor = { path = "../embassy/embassy-executor" }
embassy-time = { path = "../embassy/embassy-time" }
embassy-sync = { path = "../embassy/embassy-sync" }
embassy-futures = { path = "../embassy/embassy-futures" }
embassy-time-driver = { path = "../embassy/embassy-time-driver" }
embassy-time-queue-utils = { path = "../embassy/embassy-time-queue-utils" }
embedded-batteries-async = { path = "../embedded-batteries/embedded-batteries-async" }

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
embassy-time = { path = "../embassy/embassy-time" }
embassy-time-driver = { path = "../embassy/embassy-time-driver" }
embassy-sync = { path = "../embassy/embassy-sync" }
embassy-executor = { path = "../embassy/embassy-executor" }
embassy-futures = { path = "../embassy/embassy-futures" }
```

```toml
# mock_battery/Cargo.toml
[package]
name = "mock_battery"
version = "0.1.0"
edition = "2024"

[dependencies]
ec_common = { path = "../../ec_common", default-features = false}
embedded-batteries-async = { path = "../../embedded-batteries/embedded-batteries-async" }
battery-service = { path = "../../embedded-services/battery-service" }
embedded-services = { path = "../../embedded-services/embedded-service" }
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

[features]
default = ["noop-mode"]
thread-mode = ["ec_common/thread-mode"]
noop-mode = ["ec_common/noop-mode"]
```

```toml
# charger_project/Cargo.toml
[workspace]
resolver = "2"
members = [
    "mock_charger"
]

[workspace.dependencies]
embassy-executor = { path = "../embassy/embassy-executor", features = ["arch-std", "executor-thread"], default-features = false }
embassy-time = { path = "../embassy/embassy-time" }
embassy-sync = { path = "../embassy/embassy-sync", features = ["std"] }
embassy-futures = { path = "../embassy/embassy-futures" }
embassy-time-driver = { path = "../embassy/embassy-time-driver" }
embassy-time-queue-utils = { path = "../embassy/embassy-time-queue-utils" }
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
embedded-batteries = { path = "../embedded-batteries/embedded-batteries" }
embedded-batteries-async = { path = "../embedded-batteries/embedded-batteries-async" }
embedded-services = { path = "../embedded-services/embedded-service" }
battery-service = { path = "../embedded-services/battery-service" }
embedded-cfu-protocol = { path = "../embedded-cfu" }
embedded-usb-pd = { path = "../embedded-usb-pd" }

[patch.crates-io]
embassy-executor = { path = "../embassy/embassy-executor" }
embassy-time = { path = "../embassy/embassy-time" }
embassy-sync = { path = "../embassy/embassy-sync" }
embassy-futures = { path = "../embassy/embassy-futures" }
embassy-time-driver = { path = "../embassy/embassy-time-driver" }
embassy-time-queue-utils = { path = "../embassy/embassy-time-queue-utils" }
embedded-batteries-async = { path = "../embedded-batteries/embedded-batteries-async" }

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
embassy-time = { path = "../embassy/embassy-time" }
embassy-time-driver = { path = "../embassy/embassy-time-driver" }
embassy-sync = { path = "../embassy/embassy-sync" }
embassy-executor = { path = "../embassy/embassy-executor" }
embassy-futures = { path = "../embassy/embassy-futures" }
```

```toml
# mock_charger/Cargo.toml
[package]
name = "mock_charger"
version = "0.1.0"
edition = "2024"

[dependencies]
ec_common = { path = "../../ec_common", default-features = false}
embedded-batteries-async = { path = "../../embedded-batteries/embedded-batteries-async" }
embedded-batteries = { path = "../../embedded-batteries/embedded-batteries" }
battery-service = { path = "../../embedded-services/battery-service" }
embedded-services = { path = "../../embedded-services/embedded-service" }
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

[features]
default = ["noop-mode"]
thread-mode = ["ec_common/thread-mode"]
noop-mode = ["ec_common/noop-mode"]
```

With this in place, we have a common container that forms a workspace for the full integration, an ec_common crate for items that are shared between the subprojects, and our battery and charger projects which can continue to be built and tested individually or within an integration.

Now let's finish populating the common files.  In your `ec_common` folder, create a `src` directory.  In this location we will be adding the following files:
- __espi_service.rs__ - we created this originally in the battery project.  We'll use it here and modify it.
- __fuel_signal_ready.rs__ - also created in battery_project.
- __mutex.rs__ - used in both the battery and charger projects.  We will be modifying it slightly here.
- __mut_copy.rs__ - the macro helper for making borrow-safe duplicates (created in charger project)
- __test_helper.rs__ - used by both battery and charger projects for unit tests.
- __lib.rs__ - we'll create this file here and keep it updated.

move these files from `battery_project/mock_battery/src` to `ec_common/src`:
- espi_service.rs
- fuel_signal_ready.rs
- mutex.rs
- mut_copy.rs
- test_helper.rs

and delete these files from `charger_project/mock_charger`
- mutex.rs
- test_helper.rs

### ⚠️ Changing the [cfg(test)] flags ⚠️

We need to update our mutex.rs file here to respond to passed-in `feature` flags rather than the `#[cfg(test)]` flags we have been using.  This is because `#[cfg(test)]` only applies to the root crate being tested, not dependent crates like `ec_common`, which is where this will now reside.  Feature flags, on the other hand, are respected across crate boundaries and let us explicitly control which kind of mutex implementation is used, ensuring consistent behavior across unit tests, integration tests, and real builds.

You may have noticed in our updated `Cargo.toml` files we have introduced the `[features']` for `thread-mode` and `noop-mode`.

We will now update `ec_common/src/mutex.rs` to reflect this.  Change your `mutex.rs` file to look like this:
```rust
#[cfg(all(feature = "thread-mode", not(feature = "noop-mode")))]
pub use embassy_sync::blocking_mutex::raw::ThreadModeRawMutex as RawMutex;

#[cfg(all(feature = "noop-mode", not(feature = "thread-mode")))]
pub use embassy_sync::blocking_mutex::raw::NoopRawMutex as RawMutex;

#[cfg(not(any(
    all(feature = "thread-mode", not(feature = "noop-mode")),
    all(feature = "noop-mode", not(feature = "thread-mode")),
)))]
compile_error!("Exactly one of `thread-mode` or `noop-mode` must be enabled for ec_common.");

// Then these three lines to re-export:
pub use embassy_sync::mutex::Mutex;
pub use embassy_sync::channel::Channel;
pub use embassy_sync::signal::Signal;
```

### ⚒ Upgrading espi_service ⚒
We will need to update our `espi_service` support in a couple of ways.
We need it to be able to handle independent messages for the Battery and the Charger on different channels that we will define.
Replace the copied-over `ec_common/src/espi_service.rs` file with this new version:
```rust
use crate::mutex::RawMutex;
use battery_service::context::BatteryEvent;
use embedded_services::power::policy::charger::ChargerEvent;
use embassy_sync::signal::Signal;
use embedded_services::comms::{self, EndpointID, Internal, MailboxDelegate, Message};

pub use embedded_services::comms::MailboxDelegateError;

pub trait EventChannel {
    type Event;
    fn try_send(&self, event: Self::Event) -> Result<(), MailboxDelegateError>;
}

pub struct EspiService<
    'a, BatChannelT: EventChannel<Event = BatteryEvent>,
    ChgChannelT: EventChannel<Event = ChargerEvent>
> {
    pub endpoint: comms::Endpoint,
    battery_channel: &'a BatChannelT,
    charger_channel: &'a ChgChannelT,
    _signal: Signal<RawMutex, BatteryEvent>,
}

impl<'a, BatChannelT: EventChannel<Event=BatteryEvent>, ChgChannelT: EventChannel<Event=ChargerEvent>> EspiService<'a, BatChannelT, ChgChannelT> {
    pub fn new(battery_channel: &'a BatChannelT, charger_channel: &'a ChgChannelT) -> Self {
        Self {
            endpoint: comms::Endpoint::uninit(EndpointID::Internal(Internal::Battery)),
            battery_channel,
            charger_channel,
            _signal: Signal::new(),
        }
    }
}

impl<'a, BatChannelT, ChgChannelT> MailboxDelegate for EspiService<'a, BatChannelT, ChgChannelT>
where
    BatChannelT: EventChannel<Event = BatteryEvent>,
    ChgChannelT: EventChannel<Event = ChargerEvent>,
{
    fn receive(&self, message: &Message) -> Result<(), MailboxDelegateError> {
        if let Some(event) = message.data.get::<BatteryEvent>() {
            self.battery_channel.try_send(*event)?;
        } else if let Some(event) = message.data.get::<ChargerEvent>() {
            self.charger_channel.try_send(*event)?;
        } else {
            return Err(MailboxDelegateError::MessageNotFound);
        }

        Ok(())
    }
}
```
This version of `Espi_Service` defines a generic construction in which we provide a Channel for conveying BatteryEvents or ChargerEvents.  The channels themselves are declared and owned externally and passed in.  The the MailboxDelegate `receive` function of these channels is also externally implemented.  This keeps the separation and ownership cleanly defined.

###  ⛺ Add to `lib.rs` 
Create `ec_common/lib.rs` and name the modules that will be exported:
```rust
pub mod mutex;
pub mod mut_copy;
pub mod espi_service;
pub mod fuel_signal_ready;
pub mod test_helper;
```

### Fix up references in existing files
We need to make adjustments to the some of the files before our battery and charger projects will build in this new arrangement.

In `mock_charger/src/lib.rs`, remove the references to the no-longer-existent local `mutex` and `test_helper`
```rust
pub mod mock_charger;
pub mod virtual_charger;
pub mod mock_charger_device;
pub mod mock_charger_controller;
```

In `mock_charger/src/mock_charger_controller.rs`, find all the references to `crate::mutex` and `crate::test_helper` and change these to be `ec_common::mutex` and `ec_common::test_helper` to pull from the common crate.

In `ec_common/src/test_helper.rs` remove the line `#[cfg(test)]` above the `join_signals` function.

In `mock_charger/src/mock_charger.rs`, change the import from `crate::mutex` to `ec_common::mutex`

--

In `mock_battery/src/lib.rs`, remove the references to the moved `mutex`, `espi_service`, `fuel_signal_ready`. `types` and `test_helper`
```rust
pub mod mock_battery;
pub mod virtual_battery;
pub mod mock_battery_device;
pub mod mock_battery_controller;
```

Remove the file `mock_battery/src/types.rs` if it still exists

In `mock_battery/src/mock_battery.rs`, replace `crate::mutex` with `ec_common::mutex`

In `mock_battery/src/main.rs`, replace the line 
```rust
mod mut_copy;
```
with
```rust
use ec_common::duplicate_static_mut;
```
Replace
```rust
use mock_battery::fuel_signal_ready::BatteryFuelReadySignal;
```
with
```rust
use ec_common::fuel_signal_ready::BatteryFuelReadySignal;
```
Remove the line
```rust
use mock_battery::espi_service;
```
Remove the line
```rust
use mock_battery::types::{BatteryChannel, OurController};
```
Include the following between the end of your current imports and the start of the code (static allocators):
```rust
use embassy_sync::channel::Channel; 
use ec_common::mutex::RawMutex;
use battery_service::context::BatteryEvent;

use ec_common::espi_service::{EspiService, EventChannel, MailboxDelegateError};


pub struct BatteryChannelWrapper(pub Channel<RawMutex, BatteryEvent, 4>);

impl BatteryChannelWrapper {
    pub async fn receive(&mut self) -> BatteryEvent {
        self.0.receive().await
    }
}
impl EventChannel for BatteryChannelWrapper {
    type Event = BatteryEvent;
    fn try_send(&self, event: BatteryEvent) -> Result<(), MailboxDelegateError> {
        self.0.try_send(event).map_err(|_| MailboxDelegateError::MessageNotFound)
    }
}
pub struct NoopChannelWrapper(pub Channel<RawMutex, ChargerEvent, 1>);

impl EventChannel for NoopChannelWrapper {
    type Event = ChargerEvent;
    fn try_send(&self, _: ChargerEvent) -> Result<(), MailboxDelegateError> {
        Ok(())
    }
}
use mock_battery::mock_battery_controller::MockBatteryController;

// Define OurController as an alias
type OurController = MockBatteryController<&'static mut MockBattery>;
```
In the `entry_task` function, add the following declarations before the spawns:
```rust
    let noop_channel = NOOP_EVENT_CHANNEL.init(NoopChannelWrapper(Channel::new()));
    let espi_svc = ESPI_SERVICE.init(EspiService::new(battery_channel, noop_channel));
    let espi_svc_init = duplicate_static_mut!(espi_svc, EspiService<'static, BatteryChannelWrapper, NoopChannelWrapper>);
    let espi_svc_read = duplicate_static_mut!(espi_svc, EspiService<'static, BatteryChannelWrapper, NoopChannelWrapper>);    
```
and update the spawner calls to `espi_service_init_task` and `test_message_sender` to pass these in, like this:
```rust
spawner.spawn(espi_service_init_task(espi_svc_init)).unwrap();
```
```rust
spawner.spawn(test_message_sender(espi_svc_read)).unwrap();
```
Then we need to update those tasks:
```rust
#[embassy_executor::task]
async fn espi_service_init_task(
    espi_svc: &'static mut EspiService<'static, BatteryChannelWrapper, NoopChannelWrapper>,
) {
    embedded_services::comms::register_endpoint(espi_svc, &espi_svc.endpoint)
    .await
    .expect("Failed to register espi_service");
}
```
```rust
#[embassy_executor::task]
async fn test_message_sender(
    svc: &'static mut EspiService<'static, BatteryChannelWrapper, NoopChannelWrapper>,
) {
    use battery_service::context::{BatteryEvent, BatteryEventInner};
    use battery_service::device::DeviceId;
    use embedded_services::comms::EndpointID;

    println!("✍ Sending test BatteryEvent...");

    // Wait a moment to ensure other services are initialized 
    embassy_time::Timer::after(embassy_time::Duration::from_millis(100)).await;

    let event = BatteryEvent {
        device_id: DeviceId(1),
        event: BatteryEventInner::PollStaticData, // or DoInit, PollDynamicData, etc.
    };

    if let Err(e) = svc.endpoint.send(
        EndpointID::Internal(embedded_services::comms::Internal::Battery),
        &event,
    ).await {
        println!("❌ Failed to send test BatteryEvent: {:?}", e);
    } else {
        println!("✅ Test BatteryEvent sent");
    }
    loop {
            // now for the dynamic data:
            let event2 = BatteryEvent {
                device_id: DeviceId(1),
                event: BatteryEventInner::PollDynamicData,
            };

            if let Err(e) = svc.endpoint.send(
                EndpointID::Internal(embedded_services::comms::Internal::Battery),
                &event2,
            ).await {
                println!("❌ Failed to send test BatteryEvent: {:?}", e);
            } else {
                println!("✅ Test BatteryEvent sent");
            }

            embassy_time::Timer::after(embassy_time::Duration::from_millis(3000)).await;
        }
}
```

add this import among the imports at the top:
```rust
use embedded_services::power::policy::charger::ChargerEvent;
```
Change
```rust
static BATTERY_EVENT_CHANNEL: StaticCell<BatteryChannel> = StaticCell::new();
```
to
```rust
static BATTERY_EVENT_CHANNEL: StaticCell<BatteryChannelWrapper> = StaticCell::new(); 
```
and add the following new static allocators among the others
```rust
static NOOP_EVENT_CHANNEL: StaticCell<NoopChannelWrapper> = StaticCell::new(); 
static ESPI_SERVICE: StaticCell<EspiService<'static, BatteryChannelWrapper, NoopChannelWrapper>> = StaticCell::new();
```
Change all remaining occurrences of `BatteryChannel` with `BatteryChannelWrapper`:
```rust
    let battery_channel_for_handler = duplicate_static_mut!(battery_channel, BatteryChannelWrapper);
//...
#[embassy_executor::task]
async fn event_handler_task(
    mut controller: &'static mut OurController,
    channel: &'static mut BatteryChannelWrapper
) {
//...
```
Change
```rust
let battery_channel = BATTERY_EVENT_CHANNEL.init(Channel::new());
```
to
```rust
 let battery_channel = BATTERY_EVENT_CHANNEL.init(BatteryChannelWrapper(Channel::new()));
 ```

Finally, in `mock_battery/src/mock_battery.rs`, change
```rust
//------------------------
#[cfg(test)]
use crate::test_helper::join_signals;
```
to
```rust
//------------------------
#[cfg(test)]
use ec_common::test_helper::join_signals;
```

## Check our refactoring

You should now be able to build your `battery_project` and `charger_project` projects again.

Let's verify that. From the top-level (`ec_examples`):
```
cd battery_project
cargo build
cargo test -p mock_battery
cd ../charger_project
cargo build
cargo test -p mock_charger
```
This should build without errors and produce the test output from both the battery and charger projects.

