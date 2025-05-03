# EC Services

Embedded controller services are available for the operating system to call for various higher-level purposes dictated by specification.
The Windows Operating system defines some of these standard services for its platform.

These service interfaces include those for:
- debug services
- firmware management services
- input management services
- oem services
- power services
- time services

Implementations of ODP may be architected for both Secure and Non-Secure system firmware designs.
A non-secure design is based upon ACPI and an architecture that may allow cross-contamination of concerns between the implementation of component tasks through the services that expose them.
A Secure firmware design insures that individual tasks are not permitted to exceed the scope of thier own domain.  While certain aspects of this come from the advantages of the Rust implementation, in a "secure" implementation, access is governed by a hypervisor environment (hafnium) at the service level itself.

![Secure Architecture](./images/image1.png)

More can be learned about embedded controllers and embedded controller services for ODP by visiting the repository at [TODO](todo)

