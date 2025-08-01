# Charger
The Charger component is by nature closely associated with the battery, and could be tightly coupled as an extension to that subsystem and sharing the battery Controller. However, that would undermine the modular component advantages of ODP because the charger is an independent component and could be matched with different battery configurations.

__Battery__ and __Charger__ are two independent components, each with their own `Device`, `Controller`, and `Service`.  They are registered individually with the embedded-services framework and communicate only via messaging through our `comms` implementation.
This models real-world physical separation, where a charging circuit and a battery pack are distinct units that coordinate via well-defined interfaces.


```mermaid
graph TD
    subgraph EmbeddedServices
        Registry[Service Registry]
    end

    subgraph Battery
        BatteryDevice[BatteryDevice -- _impl Device_]
        BatteryController[BatteryController -- _impl Controller_]
    end

    subgraph Charger
        ChargerDevice[ChargerDevice -- _impl Device_]
        ChargerController[ChargerController -- _impl Controller_]
    end

    BatteryDevice --> BatteryController
    ChargerDevice --> ChargerController

    BatteryController --> Registry
    ChargerController --> Registry
    BatteryDevice --> Registry
    ChargerDevice --> Registry
```

The `BatteryDevice` contains both the `SmartBattery` implementation (as battery) and the `Charger` implementation (as charger).
The `BatteryDevice` is registered with the `BatteryController`, which polls the battery, interprets the data, and invokes charger methods to respond to battery needs.

```mermaid
sequenceDiagram
    participant ChargerController
    participant BatteryController

    ChargerController->>BatteryController: Request battery status
    BatteryController-->>ChargerController: BatteryState _voltage, temp, soc_

    ChargerController->>BatteryController: Apply charging parameters

    BatteryController-->>ChargerController: Ack / Updated status
```    

When paired with the battery, the two work in concert:

```mermaid
sequenceDiagram
    participant PolicyManager
    participant BatteryController
    participant BatteryDevice
    participant Battery
    participant ChargerController
    participant ChargerDevice
    participant Charger

    PolicyManager->>BatteryController: poll()
    BatteryController->>BatteryDevice: read_status()
    BatteryDevice->>Battery: get_status()
    Battery-->>BatteryDevice: BatteryStatus { low_charge: true }
    BatteryDevice-->>BatteryController: BatteryStatus
    BatteryController-->>PolicyManager: BatteryStatus

    PolicyManager->>ChargerController: apply_charge(mA, mV)
    ChargerController->>ChargerDevice: charging_current(mA)
    ChargerDevice->>Charger: set_current(mA)
    Charger-->>ChargerDevice: Ok(mA)
    ChargerDevice-->>ChargerController: Ok(mA)

    ChargerController->>ChargerDevice: charging_voltage(mV)
    ChargerDevice->>Charger: set_voltage(mV)
    Charger-->>ChargerDevice: Ok(mV)
    ChargerDevice-->>ChargerController: Ok(mV)

    ChargerController->>PolicyManager: Charging applied
```

Here, the controller polls the battery state, and the battery indicates that is has a low charge.  The controller determines the charging parameters and instructs the charger.  The battery charge level should now improve as the charge is applied over time.




