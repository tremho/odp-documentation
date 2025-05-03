# ODP Repositories and bookshelves

There are currently more than a dozen separate repositories that make up the ODP offering.  This is deliberate - rather than having a single Mono-Repo that
contains the full suite, individual repositories allows contributors focused on specific areas to only concern themselves with their repositories of interest rather than devote time and resources to managing a local copy of a large single repository.

However, with separated repositories, a challenge arises when trying to introduce and document the whole of ODP in a consistent manner.  For that reason, documents are organized as separate books but "placed on different shelves" according to their scope and audience.

## Bookshelves
In the same way that a book shelf in the physical world is a holder of books, an ODP library bookshelf is a holder of web page content. This content may be generated Rust API documentation, or mdbook style contextual information, or in some cases other imported web-displayable content.

The shelves are organized as follows:
- Shelf 1: Introduction and Concepts
- Shelf 2: Examples and Tutorials
- Shelf 3: Supporting crates and SDKs
- Shelf 4: Specifications and API references

------
scratch notes - 

###### Shelf 1 (introduction)
- Introduction to ODP (this book)
- UEFI Evolution to Patina (documentation shelf 1 - uefi book)
- Developing UEFI with Rust (note: consider retitling to Developing Boot Firmware with Patina) (uefi-dxe-core book)

###### Shelf 2 (examples and tutorials)
- QEMU Setup (documentation shelf 1 - book)
- embassy-imxrt rt633 (repo)
- embassy-imxrt rt685s-evk (repo)
- embedded-services rt633 (repo)
- embedded-services rt685s-evk (repo)
- embedded-services std (repo)
- mimxrt685s-examples (repo)

###### Shelf 2 (reference implementation examples)
_link to repository home page_
- is32fl3743b (LED Matrix controller)
- MX25U1632FZUI02
- tmp108
- tps6699x

###### Shelf 3 (supporting crates and SDK)
_link to repository home page_
- embedded-cfu
- embedded-sensors
- embedded-services 
- ffa
- odp-utilities
- uefi-core
- uefi-dxe-core
- uefi-sdk

##### Shelf 4 (specifications and API)
_gen api docs for all repos listed on shelves 2 and 3_
- modern-payload
- uefi-dxe-core (gen api doc)

