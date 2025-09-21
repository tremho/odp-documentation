# The Thermal Component Example

In this example we will be constructing a functioning mock thermal component subsystem, similar to what we have done
previously for Battery and Charger components.

## Goals

The thermal itself will be virtual - no hardware required - and the behavioral aspects of it will be simulated.
We will, however, discuss what one would do to implement actual thermal hardware control in a HAL layer.

In this example, we will:

- Define the Traits of the thermal component
- Identify the hardware actions that fulfill these traits
- Define the HAL traits to match these hardware actions
- Implement the HAL traits to hardware access (or define mocks for a virtual example)
- Wrap this simple Traits implementation into a Device for service insertion
- Provide the service layer and insert the device into it
- Test the end result with unit tests and simple executions
