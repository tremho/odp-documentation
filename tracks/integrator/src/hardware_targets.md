# Preparing for Hardware Targets
While QEMU-based builds are ideal for development and testing, most real-world use cases require deployment to actual hardware platforms. Here we will point out some of the key steps, challenges, and considerations when preparing an ODP-based firmware system for hardware targets.

## Changes when targeting real hardware
| Aspect | QEMU | Hardware |
|--------|------|----------|
| Peripherals | Virtualized and generic | Must match actual hardware |
| Flash Layout | Loosely defined | Must adhere to board specifications |
| Console / Logs | `stdout` or `debug.log` | UART/serial or memory-mapped output |
| Bootloader | `stuart_build` wrapper | coreboot, U-Boot, ROM Bootloader |
| EC-HAL | Fully mocked | Must be implemented for real I/O |

## Firmware Packaging
- For __Patina__:
    - The `.efi` binary must be embedded into the platform firmware image
    - Secure boot considerations apply (keys, signatures)
    - On some platforms (coreboot, U-Boot), a custom payload loader may be required

- For __EC__:
    - The final `.elf` or `.bin` must target your microcontroller's flash layout.
    - Build system should include appropriate memory map
    - External flash programming may be needed (e.g. SWD/JTAG, USB DFU)

## HAL Transition Checklist
Replacing mocks with real hardware access requires caution and hardware validation.

 ☐ Is your HAL for I2C, GPIO, ADC, etc. implemented for your board?

 ☐ Are your EC services updated to use the correct HAL instance?

 ☐ Have you validated pin mappings and timing constraints?

 ☐ Is your async runtime configured correctly for interrupts, clocks, and wake/sleep behavior?

 ☐ Are all non-implemented traits hidden behind feature flags or marked `unimplemented!()`?

## Secure Services and Platform Constraints

- __FF-A support__ (used by EC secure services) is _not available on x86 platforms_ — fallback mechanisms are needed

- Memory buffers for __FF-A__ (on ARM) must be in reserved and trusted memory regions

- __BIOS/UEFI__ loaders on some x86 platforms may block or filter EC messages

- Ensure your platform’s firmware is not intercepting __ACPI__ or __EC I/O__, unless explicitly intended
