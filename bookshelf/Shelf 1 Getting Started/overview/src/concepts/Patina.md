# Patina
## (Boot Firmware)

___Patina___ is the name given to UEFI-compliant boot firmware developed using ODP patterns.

It is based upon the venerable __UEFI__ standard and doesn't seek to reinvent the process of this well-known
framework, as it necessarily re-implements these familiar patterns in Rust instead of C.

### A review of UEFI
__UEFI__ stands for _Unified Extensible Firmware Interface_ and can be described as broken into a series of layers, as this diagram shows:

![PI_Boot_phases](./images/PI_Boot_Phases.jpg)
_(diagram source: TianoCore, , illustrating the PI Boot Flow from SEC to RT phase)_

This boot-time firmware is executed by the platform main CPU on startup/reset and proceeds through the stages shown in the diagram.  As part of its initialization, it may communicate with the embedded system microcontrollers that are also under the control of ODP rust drivers to initiate and orchestrate them to a starting state.

While the majority of ODP development focuses on the __DXE__ phase, Patina also supports implementation in the __PEI__, __SEC__ and other phases.  

Some aspects of UEFI, especially those that have already been deprecated, may not be supported under ODP.  These are legacy services, UI facilitators, and some Runtime Support components that either no longer serve a core purpose or can more effectively be implemented in other ways within ODP.

### ODP Resources for UEFI

For traditional UEFI development, an SDK called __EDK II__ is often used to supply much of the common functionality.

However, the __EDK II__ presumes the use of C, and ODP is seeking to replace this potentially insecure code base with Rust for future devices.

ODP features a subproject body of code that represents the elements one might traditionally find within the EDK II, but designed for Rust.  

[UEFI-SDK Repository](https://github.com/OpenDevicePartnership/uefi-sdk)

[Documentation](https://github.com/OpenDevicePartnership/uefi-sdk/releases/doc/boot_services/index.html)

_(internal note to reviewers: link above is empty - TODO: Replace with link to a github release with an actual cargo doc rendering when ready)_

This SDK-like material covers
- Boot services
- Driver binding
- Runtime services
- TPL mutex (Task Priority Level critical sections)
- UEFI protocol
- Component Support
    - Component Template
    - Parameters
    - Hand-Off Block (HOB)
    - Scheduler metadata
    - Service interface
    - Storage support
- Serial logging support
- Serial UART support and std i/o
- Macros and helpers


### How this compares to traditional UEFI approaches

There are differences in the ODP approach here in a couple areas.  One significant departure is that in ODP there is no traditional SMM (System Management Mode).

SMM is a special-purpose operating mode provided by x86 CPUs (and compatible architectures) for executing highly privileged system-level code, independently of the operating system.

- It is triggered by a System Management Interrupt (SMI).

- Code running in SMM has full control over the system, including memory, I/O, and other hardware.

- It is isolated: the OS (and even hypervisors) cannot access or interfere with SMM execution or memory (SMRAM).

This may seem more than a little significant at first because SMM is used in key EDK II contexts, including:

- SmmCore
- SmmDriver
- SmmCommunication
- SmmVariable

But there is good reason for this omission:

Traditional SMM is not supported to prevent coupling between the DXE and MM environments. This exclusion extends to so-called 'combined' DXE modules also. 
These patterns are error-prone, increase DXE module complexity, and elevate the risk of security vulnerabilities.

Standalone MM should be used instead. The combined drivers have not gained traction in actual implementations due to their lack of compatibility for most practical purposes and further increase the likelihood of coupling between core environments and user error when authoring those modules. The Rust DXE Core focuses on modern use cases and simplification of the overall DXE environment.

For a technically detailed tour of how to implement UEFI-style boot code under Patina, see [Introduction - Developing UEFI with Rust](https://github.com/OpenDevicePartnership/uefi-dxe-core/docs/book/index.html)

_(internal note to reviewers: link above is empty - TODO: Replace with link to actual rendered book copy from the reference shelf)_

### What's Next?
In following chapters we'll explore how Patina components interact within the DXE Core, how to define UEFI services in Rust, and how to develop real-world DXE drivers using ODP tools.





