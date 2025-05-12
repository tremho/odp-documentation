# Supporting crates 

There are a number of 3rd party crates that are useful for this type of development.  Of course, almost any crate could be used - mindful of any dependencies, of course - but there are a couple of notable packages that deserve some special attention.

### Embassy
Embassy is a Rust framework designed for microcontroller development, and has common Hardware Abstraction Layer support for many chipsets.  
It leverages Rust's built-in async/await features to provide multitasking that is faster and smaller than a traditional RTOS implementation.
It provides consistent timing abstractions, task prioritization, and supports low-power operation, networking, bluetooth, and USB features.
Boot loader and firmware update support is also provided.

### Hafnium
Hafnium is a Secure Partition Manager for Arm processors. Hafnium itself is maintained as part of the TrustedFirmware organization.
https://www.trustedfirmware.org/projects/hafnium
https://hafnium.readthedocs.io/en/latest/index.html

For implementing under ODP in Arm Hafnium is assumed to be available in the environment that supports it.

### DICE
The Device Identifier Composition Engine is a [specification](https://trustedcomputinggroup.org/wp-content/uploads/TCG-Endorsement-Architecture-for-Devices-V1-R38_pub.pdf
) from the [Trusted Computing Group](https://trustedcomputinggroup.org/what-is-a-device-identifier-composition-engine-dice/)

In essence, DICE describes a crytography library used to validate signed payloads in a public/private key fashion.




