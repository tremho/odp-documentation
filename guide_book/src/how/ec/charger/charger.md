# Charger

The charger is not an independent runtime component itself. It is a tightly couple extension of the battery and answers to the `BatteryController` via `SmartBattery` interface.  The `Controller` determines charging behaviors of its `BatteryDevice` via the `SmartBattery` traits of its inner battery component, and then calls upon its inner charger component to adjust the charging profile.  

```mermaid
graph TD
    A[BatteryController] -->|polls| B[BatteryDevice]
    B --> C[SmartBattery Impl]
    B --> D[Charger Impl]
    A -->|adjusts charging| D

    subgraph Device Internals
        B
        C
        D
    end
```
The `BatteryDevice` contains both the `SmartBattery` implementation (as battery) and the `Charger` implementation (as charger).
The `BatteryDevice` is registered with the `BatteryController`, which polls the battery, interprets the data, and invokes charger methods to respond to battery needs.

```mermaid
sequenceDiagram
    participant Controller
    participant Device
    participant Battery
    participant Charger

    Controller->>Device: poll()
    Device->>Battery: read_status()
    Battery-->>Device: BatteryStatus { low_charge: true }
    Device-->>Controller: BatteryStatus

    Controller->>Device: apply_charge(MilliAmps, MilliVolts)
    Device->>Charger: charging_current(MilliAmps)
    Charger-->>Device: Ok(MilliAmps)
    Device-->>Controller: Ok(MilliAmps)
    Device->>Charger: charging_voltage(MilliVolts)
    Charger-->>Device: Ok(MilliVolts)
    Device-->>Controller: Ok(MilliVolts)
    Controller->Controller: Charging adjustment complete
```

Here, the controller polls the battery state, and the battery indicates that is has a low charge.  The controller determines the charging parameters and instructs the charger.  The battery charge level should now improve as the charge is applied over time.




