# Embedded Controller Architecture

The construction of a typical component under the control of a service subsystem looks as follows:

```mermaid
flowchart LR
    A[Some Service<br><i>Service initiates query</i>]
    B[Subsystem Controller<br><i>Orchestrates component behavior</i>]
    C[Component Trait Interface<br><i>Defines the functional contract</i>]
    D[HAL Implementation<br><i>Implements trait using hardware-specific logic</i>]
    E[EC / Hardware Access<br><i>Performs actual I/O operations</i>]

    A --> B
    B --> C
    C --> D
    D --> E

    subgraph Service Layer
        A
    end

    subgraph Subsystem Layer
        B
    end

    subgraph Component Layer
        C
        D
    end

    subgraph Hardware Layer
        E
    end
```

When in operation, it conducts its operations in response to message events

```mermaid
sequenceDiagram
    participant Service as Some Service
    participant Controller as Subsystem Controller
    participant Component as Component (Trait)
    participant HAL as HAL (Hardware or Mock)

    Service->>Controller: query_state()
    Note right of Controller: Subsystem logic directs call via trait
    Controller->>Component: get_state()
    Note right of Component: Trait implementation calls into HAL
    Component->>HAL: read_some_level()
    HAL-->>Component: Ok(0)
    Component-->>Controller: Ok(State { value: 0 })
    Controller-->>Service: Ok(State)

    alt HAL returns error
        HAL-->>Component: Err(ReadError)
        Component-->>Controller: Err(SomeError)
        Controller-->>Service: Err(SomeUnavailable)
    end

```

A core pattern of the ODP architecture is one of __Dependency Injection__.  The service and subsystem `Traits` define the functional contract of the component, while the HAL implementation provides the hardware-specific logic. This allows for a clear separation of concerns and enables the component to be easily tested and reused across different platforms. Components are eligible to be registered for their subservice if they match the required traits.

```mermaid
flowchart TD
    subgraph Component
        A[Needs Logger and Config]
    end

    subgraph Framework
        B[Provides ConsoleLogger]
        C[Provides NameConfig]
        D[Injects Dependencies]
    end

    B --> D
    C --> D
    D --> A
```
