# Security and operational policy

**Unaudited reference. No production approval.** Root MIT license covers new code; upstream licenses/notices remain applicable. OpenFour samples explicitly identify themselves as unaudited references.

Owned implementations are deployed code, but current OpenFour modules are instantiated through Registry-managed upgradeable beacons. Registry/Core governance can change behavior; do not represent module instances as immutable clones. Per-token bridge, peer, bootstrap values, oracle, source registry, endpoint and migration composition are fixed. Source registry entries cannot be replaced. Administrative OApp methods remain available to owner/delegate; review their full inherited ABI, not just the subclass.

Use separate multisigs for source admission, endpoint configuration and source program upgrade/pause roles. Document thresholds, timelocks, recovery signers and monitoring endpoints. Do not confuse endpoint delegate transfer with Solana program upgrade-authority transfer. Revoking a program upgrade authority is irreversible and is a separate deployment decision. Registry admission is a trusted assertion of source custody implementation; it cannot independently prove an account's state from EVM.

No production keys or secrets are in this repository. Local Ganache deterministic accounts are test-only; the attestation test signer is generated in memory. Testnet deployment uses an external signer account. The optional attestation signer reads an environment variable and prints only the signed observation.

No cancellation or emergency source release is implemented. A failed launch may leave inventory locked; do not improvise refunds or upgrade escrow to release outstanding backing. Bridge pausing does not pause an already migrated DEX, and source pausing may delay redemption after a destination burn. Publish both states in the UI.

MVP accepts legacy SPL only, no freeze authority, no mint authority, six or more local decimals, bounded uint64 units and exact bootstrap normalization. Verify on-chain program owner and actual accounts at finalized commitment; an asset metadata JSON is not admission proof. Recheck program upgrade authority and mint state before bootstrap. Use one canonical Adapter store; source admin must not repoint a live destination peer to a competing representation.

Fees are not hidden in the curve. After graduation, registered pool transfers pay a fixed 15-bps token tax to `0x2b057980e924B2aA8f6B80Bb5c8A669EE3753dc1`; see [POOL_TAX.md](POOL_TAX.md) for rounding, liquidity-operation taxation and fee-aware routing requirements. The tax is separate from DEX fees and any Core fee policy. This version's validator cannot read outer anti-sniper/presale or private fee configuration and does not enforce an aggregate trading fee ceiling. The tax uses internal token transfers with no external callback, recipient setter or rate setter.

Security reporting contact: **submission team to fill**. Defensive code review: [SECURITY_REVIEW.md](SECURITY_REVIEW.md). Independent audit: **not performed**. Mainnet addresses: **none**. Required release gates are in FOURMEME_REVIEW_CHECKLIST.md.
