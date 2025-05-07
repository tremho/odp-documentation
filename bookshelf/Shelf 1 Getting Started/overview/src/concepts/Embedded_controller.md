# Embedded Controller

![ODP Architecture](./images/simplified_layers.png)

An Embedded Controller is typically a single SOC (System on Chip) design capable of managing a number of low-level tasks.

These individual tasked components of the SOC are represented by the gold boxes in the diagram. The ODP Support for Embedded Controller development is represented in the diagram in the green boxes, whereas third party support libraries are depicted in blue.

## Secure vs Non-Secure

The "owned interface" in this diagram represents the available data transport (UART, eSPI, IC2, IC3, shared memory) and 
can be considered to be either a "Secure" channel for data communication or a "Non-Secure" channel. An implementation may use more than one transport for different controller and controller service needs.

A "Secure" transport is one that can validate and trust the data from the channel, using cryptographic signatures and hypervisor isolation to insure the integrity of the data exchanged.
Not all such channels must necessarily be secure, and indeed in some cases depending upon the components used it may not even be possible to secure a channel.  The ODP approach is agnostic to these decisions, and can support either or both patterns of
implementation.

Two similar sounding, but different models become known here.  One is SMM, or "System Management Mode". SMM is a high-privilege CPU mode for x86 microcontrollers that EC services can utilize to gain access. To facilitate this, the SMM itself must be secured. This is done as part of the boot time validation and attestation of SMM access policies.  With this in place, EC Services may be accessed by employing a SMM interrupt.

For A deeper dive into what SMM is, see [How SMM isolation hardens the platform](https://www.microsoft.com/en-us/security/blog/2020/11/12/system-management-mode-deep-dive-how-smm-isolation-hardens-the-platform/?msockid=1c8509b122806f6b2c281c61233a6e3e)

Another term seen about will be "SMC", or "Secure Memory Control", which is a technology often found in ARM-based architectures. In this scheme, memory is divided into secure and non-secure areas that are mutally exclusive of each other,  as well as a narrow section known as "Non-Secure Callable" which is able to call into the "Secure" area from the "Non-Secure" side. 

Secure Memory Control concepts are discussed in detail with this document: 
[TrustZone Technoogy for Armv8-M Architecture](https://developer.arm.com/documentation/100690/0201)

SMM or SMC adoption has design ramifications for EC Services exchanges, but also affects the decisions made around boot firmware, and we'll see these terms again when we look at ODP Patina implementations.

### Hypervisor context multiplexing
Another component of a Secure EC design is the use of a hypervisor to constrain the scope of any given component service to a walled-off virtualization context. One such discussion of such use is detailed [in this article](https://www.microsoft.com/en-us/security/blog/2018/06/05/virtualization-based-security-vbs-memory-enclaves-data-protection-through-isolation/?msockid=1c8509b122806f6b2c281c61233a6e3e)


### The Open Device Partnership defines:
- An "owned interface" that communicates with the underlying hardware via the available data transport .
- We can think of this transport as being a channel that is considered either "Secure" or "Non-Secure".  
- This interface supports business logic for operational abstractions and concrete implementations to manipulate or interrogate the connected hardware component.
- The business logic code may rely upon other crates to perform its functions. There are several excellent crates available in the Rust community that may be leveraged, such as [Embassy](https://embassy.dev/).
- Synchronous and asynchronous patterns are supported.
- No runtime or RTOS dependencies.

An implementation may look a little like this:

![ODP Arch](./images/odp_arch.png)
