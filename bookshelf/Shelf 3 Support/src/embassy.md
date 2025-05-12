# Using Embassy 

Embassy provides abstractions for higher-level operations that work across a number of different microcontroller devices in similar ways.  There are layers to this design.

## PAC
The Peripheral access crate is the lowest level of this abstraction. One can always write
directly to memory addresses to control their hardware, but the PAC at least raises this to 
a symbolic level with consistent semantics.

For example, this code is used to access a GPIO-based LED
```rust
    // Setup LED
    let gpiob = pac::GPIOB;
    const LED_PIN: usize = 14;
    gpiob.pupdr().modify(|w| w.set_pupdr(LED_PIN, vals::Pupdr::FLOATING));
    gpiob.otyper().modify(|w| w.set_ot(LED_PIN, vals::Ot::PUSH_PULL));
    gpiob.moder().modify(|w| w.set_moder(LED_PIN, vals::Moder::OUTPUT));
```
The actual memory mapping is done by the PAC layer.

## HAL
The next level of abstraction is the Hardware Abstraction Layer.  The HAL wraps features of the hardware itself (clock, GPIO, temp, etc) into apis relevant to that hardware.

In a HAL implementation, the code relevant to LED control would be simplified to this:
``` rust
use embassy_stm32::gpio::{Input, Level, Output, Pull, Speed};

//...
let mut led = Output::new(p.PB14, Level::High, Speed::VeryHigh);
led.set_high();
//...
led.set_low();
```
These abstraction layers serve to provide standardized efficiency for common hardware operations while still maintaining complete control.

## Interrupts
Responding to interrupts allows the code to respond asynchronously for a registered hardware action to trigger while either performing another task or simply waiting in low-power mode for something to happen.

## async executor
Building on this concept, we arrive at the Embassy asynchronous executor (aka Spawner) that allows a set of tasks that can be run in a cooperative asynchronous mode.  When a task blocks to wait for IO, the executor can switch to run another task.  
The ["Embassy Book"](https://embassy.dev/book/) lists the following key features of the Embassy Executor:

- No alloc, no heap needed. Task are statically allocated.

- No "fixed capacity" data structures, executor works with 1 or 1000 tasks without needing config/tuning.

- Integrated timer queue: sleeping is easy, just do Timer::after_secs(1).await;.

- No busy-loop polling: CPU sleeps when there’s no work to do, using interrupts or WFE/SEV.

- Efficient polling: a wake will only poll the woken task, not all of them.

- Fair: a task can’t monopolize CPU time even if it’s constantly being woken. All other tasks get a chance to run before a given task gets polled for the second time.

- Creating multiple executor instances is supported, to run tasks at different priority levels. This allows higher-priority tasks to preempt lower-priority tasks.

## Consistent Time
Embassy provides time drivers for key platforms.  This abstraction greatly simplifies common timing tasks and provides portable semantics.

## Bootloader and peripheral support
Embassy also features a bootloader and firmware update support. This allows you to flash update the firmware in a power-safe manner. Verification features are also available.

Embassy has API support for Networking, USB, WiFi, LoRa, and Bluetooth that may be leveraged,
as well as examples for resource sharing across common bus types (such as SPI and I2C).

## Summary
Implementing ODP patterns under Embassy is a highly viable and preferred route since it removes many of the low-level areas of tedious and error-prone mapping tasks and implements proven working designs for the tougher problems of multitasking, timing, and resource sharing.

