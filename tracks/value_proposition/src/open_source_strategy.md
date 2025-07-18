# Open-source Strategy
The Open Device Partnership (ODP) is open source by design, not by afterthought. Its goal is to create a shared foundation for secure, modular firmware that anyone can audit, extend, or build upon — whether you're a silicon vendor, OEM, platform integrator, or open hardware enthusiast.

## Open Source Strategic Advantages
- **Transparency**: ODP's open source nature allows anyone to inspect the code, ensuring that security and design decisions are visible and verifiable. This transparency builds trust among users and developers.
- **Community-Driven**: ODP thrives on community contributions. Developers can propose changes, report issues, and collaborate on features. This collective effort accelerates innovation and improves the quality of the codebase.
- **Interoperability**: By adhering to open standards and interfaces, ODP components can be reused across different hardware and software ecosystems. This reduces vendor lock-in and promotes a more diverse ecosystem.
- **Sustainability**: Open source fosters long-term sustainability. As the community grows, the project benefits from a wider pool of contributors, ensuring that it can adapt to new challenges and technologies over time.        
- **Education and Onboarding**: Open source projects provide an excellent learning platform for new developers. ODP's documentation, examples, and community support make it easier for newcomers to get involved and contribute.   
- **Innovation**: Open source encourages experimentation and innovation. Developers can build on existing ODP components, creating new features or adapting them for specific use cases without starting from scratch.      
- **Vendor Neutrality**: ODP is designed to be vendor-neutral, allowing any organization to implement it without being tied to a specific vendor's ecosystem. This promotes healthy competition and prevents monopolistic practices.

### What's Open? (And What Isn't)
ODP is committed to open source principles, but there are some exceptions for some of the referenced specific integrations, accessories and tools:
| Area | Status |
|------|--------|   
| Patina SDK | ✅ Fully Open (Rust DXE Core + sample components) |
| EC Runtime | ✅ Fully Open (async executor + services + mocks) |
| Tooling (FW patcher, setup scripts) | ✅ Open  |
| Platform-Specific Drivers | ⚠️ Some may be proprietary or stubbed |
| Reference Boards | ⚠️ May include closed blobs for silicon init |
| Contributor Roadmap | ✅ Open (community-driven) <br/>✅ Transparent (tracked in GitHub issues/PRs) |

## A rising tide raises all boats
ODP's open source strategy is not just about making code available; it's about fostering a culture of collaboration and shared learning. By engaging with the broader open source community, ODP aims to raise the standards of firmware development across the industry. This means not only sharing code but also best practices, design patterns, and lessons learned. This fosters a higher standard of quality and security in firmware development, benefiting everyone involved.


