# Secure EC Services


```mermaid
flowchart TD
    subgraph Host System
        A1[ACPI Methods]
        A2[ACPI Notification Events]
    end

    subgraph Secure World
        B1["Hafnium (FFA Handler)"]
    end

    subgraph EC
        C1[EC Dispatcher]
        C2[Subsystem Controller]
    end

    A1 -->|"Secure Path (ARM/FFA)"| B1
    A2 -->|Notifications| B1
    B1 -->|Structured Command| C1
    C1 --> C2

    A1 -->|"Non-Secure (x86)"| C1
```

> __Figure: Host–EC Communication Paths__
>
> The host communicates with the EC via __ACPI__ calls and notification events. On __ARM__ platforms with secure world enforcement, messages are routed through __Hafnium__ via __FF-A__ interfaces. On __x86__ platforms, communication is direct. The EC dispatcher then forwards commands to appropriate subsystem controllers.
