# Contract ABIs — source of truth for event decoding

The **authoritative, compiled** ABIs for the ERC-8004 registries, copied verbatim
from the official contracts repo (`erc-8004/erc-8004-contracts`, `abis/` dir).
Use these — not hand-read `event` declarations from the `.sol` source — to decode
logs: the compiled ABI includes **inherited** events (e.g. ERC-4906
`MetadataUpdate`/`BatchMetadataUpdate`, OpenZeppelin `Approval`, `Upgraded`) that
the registry `.sol` files don't declare themselves. That gap is exactly what
caused the `0xf8e1a15a` "mystery event" — it's the inherited ERC-4906
`MetadataUpdate(uint256)`.

To regenerate the topic0 → event map: `keccak256("EventName(type1,type2,…)")`.

| File | Deployed (Ethereum mainnet) | Notes |
|---|---|---|
| `IdentityRegistry.json` | proxy `0x8004a169…` → impl `0x7274e874…` | 12 events |
| `ReputationRegistry.json` | proxy `0x8004baa1…` → impl `0x16e0fa7f…` | 6 events |
| `ValidationRegistry.json` | **not deployed anywhere** | for when it launches |

These are UUPS proxies; the proxy address delegates to the implementation, which
holds the event definitions. Both proxies were upgraded only at launch
(2026-01-29) and have been stable since.
