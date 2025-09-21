# Building the component

We will now start building the component.  The first step is to create a new project for the thermal component, which we will call `thermal_project`.  This project will be a workspace that contains the thermal service and the mock thermal component.

we will then follow what by now should be a familiar pattern for creating the mock components, defining the traits, and implementing the HAL traits to access the hardware (or mocks for a virtual example).

Then we'll wrap this simple Traits implementation into a Device for service insertion, provide the service layer, and insert the device into it. From there we can attach the controller that we can register with the EC service.  

At this point we will have a functioning mock thermal component subsystem, similar to what we have done previously for Battery and Charger components, and we will be able to test the end result with unit tests and simple executions.


