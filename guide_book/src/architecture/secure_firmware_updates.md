# Secure Firmware Updates
Secure firmware update mechanisms are critical to preserving system trust over time. They prevent unauthorized or malicious firmware from being flashed, and protect the system from rollback to known-vulnerable versions. ODP-based firmware components, including Patina and the EC runtime, support signed and validated update flows.

## Update Integrity Requirements
Firmware updates must meet several key integrity requirements:
- **Authentication**: Updates must be signed by a trusted vendor key.
- **Integrity**: Payloads must not be tampered with (crytopgraphic hashes are checked).
- **Rollback Protection**: Systems must prevent downgrading to older, potentially vulnerable firmware versions.
- **Isolation**: Updates must not interfere with runtime operations, allow modification of unrelated components, or expose sensitive data.

```mermaid
flowchart LR
    A[Host System or Update Agent]
    B[Receives Update Payload]
    C[Verifies Signature]
    D[Checks Version Policy]
    E[Applies Update]
    F[Reboots to New Firmware]

    A --> B --> C --> D --> E --> F
```
> __Figure: Generic Secure Update Flow__
>
> Update delivery may be initiated by the OS or host firmware. The platform verifies signatures and version constraints before committing the update and restarting the system.