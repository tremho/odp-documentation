# Building for the Embedded Target

We've validated our simplistic mock battery has implemented basic traits, and we've been able to do that with a generic build on the desktop.

Now we want to see about getting it built for an actual embedded target board.

Which development board we use at this point isn’t critical. Our mock battery and simulated components will remain software-only for now, so we don’t need physical hardware peripherals or a fully implemented HAL. Later, when we explore advanced features like ARM TrustZone or Hafnium hypervisor integration, we may need a specific Cortex-M board — but those can be hard to source. So rather than lock ourselves in too early, we’ll keep this next section general and adaptable to what you may already have.

In particular, if you've followed the excellent  [Rust Embedded Book](https://docs.rust-embedded.org/book/), there's a good chance you already have an STM32 Discovery board on hand. These boards are inexpensive, well-supported, and ideal for this stage of development.

The examples here will use the STM32F3 Discovery board. If you're using a different board, you may need to adjust your configuration accordingly. That said, our code will aim to be as portable and HAL-independent as possible.

## Getting Set Up

To build for an embedded target, we need to prepare our development environment with a few important tools and configuration files.

While there are many variations depending on target board and host OS, we will aim to keep this setup as broadly compatible and standard as possible.

### Installing the Embedded Rust Toolchain

The standard Rust toolchain needs a few additions to suppor cross-compiling for emedded targets.

Staying within your current `battery_project` workspace, 
run
```
rustup target add thumbv7em-none-eabihf
```

_TODO: The rest of this section has been removed and will be revised for the new approach_
