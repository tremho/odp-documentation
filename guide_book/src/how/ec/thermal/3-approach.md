# How we will build the Thermal Component

We will now start building the component. The first step is to create a new project for the thermal component, which we will call `thermal_project`. This project will be a workspace that contains the thermal service and the mock thermal component.

## Two components: Mock Sensor and Mock Fan
In the previous examples, we created mock battery and charger components. In this example, we will create two components: a mock sensor and a mock fan. These components will be used to simulate the behavior of the thermal component. 

Each component is independent, but is orchestrated together by policy. Later, when we do the integration testing, we will explore this choreography in more detail.

For this project, we will focus on the sensor and fan components themselves, and provide unit tests for them.







