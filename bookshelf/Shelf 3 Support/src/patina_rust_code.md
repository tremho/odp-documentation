# Patina Rust Code
The ["patina" repository](https://github.com/OpenDevicePartnership/patina) contains the UEFI implementation in Rust maintained by Open Device Partnership.

Here is where the core and components are defined and built.  

There is a lot in here to unpack. You will recall from this diagram the various components sections of UEFI:

![UEFI Diagram](./images/PI_Boot_Phases.jpg)

All of these sections can be found covered in the Patina implementation. 
The DXE Core (colloquially pronounced "Dixie") is the Driver Execution Environment and where most of the key development for components is centered.  
There is also of course the Runtime Services (RT) that continue beyond boot of the OS.
And there are all the parts in between, including security management, transient system load (TSL) handling, logging, boot device selection, and so forth.
There are some key differences between a conventional UEFI implmentation and Patina.
One such difference is there is no traditional EFI Dispatcher.  Instead, the DXE Core is built monolithically using dependency injection for the drivers that are bound to a prescribed function.

Read more about the construction and differences of the Patina code base in the [Patina Documentation](https://sturdy-adventure-nv32gqw.pages.github.io/)

## What are we doing here?
We are going to explore making our own driver interfaces for our customized Rust boot firmware from this base.

(TODO)

