# Security and operational policy

**Unaudited reference. No production approval.** Root MIT license covers new code; upstream licenses/notices remain applicable. OpenFour samples explicitly identify themselves as unaudited references.

Contracts are non-proxy implementations deployed as immutable code. OpenFour clones delegate to the implementation selected at creation; confirm production deployer is an immutable clone rather than an upgradeable proxy. Per-token bridge, peer, bootstrap values, oracle, source registry, endpoint and migration composition are fixed. Source registry entries cannot be replaced. Administrative OApp methods remain available to owner/delegate; review their full inherited ABI, not just the subclass.

Use separate multisigs for source admission, endpoint configuration and source program upgrade/pause roles. Document thresholds, timelocks, recovery signers and monitoring endpoints. Do not confuse endpoint delegate transfer with Solana program upgrade-authority transfer. Revoking a program upgrade authority is irreversible and is a separate deployment decision. Registry admission is a trusted assertion of source custody implementation; it cannot independently prove an account's state from EVM.

No production keys or secrets are in this repository. Local Ganache deterministic accounts are test-only; the attestation test signer is generated in memory. Testnet deployment uses an external signer account. The optional attestation signer reads an environment variable and prints only the signed observation.

No cancellation or emergency source release is implemented. A failed launch may leave inventory locked; do not improvise refunds or upgrade escrow to release outstanding backing. Bridge pausing does not pause an already migrated DEX, and source pausing may delay redemption after a destination burn. Publish both states in the UI.

MVP accepts legacy SPL only, no freeze authority, no mint authority, six or more local decimals, bounded uint64 units and exact bootstrap normalization. Verify on-chain program owner and actual accounts at finalized commitment; an asset metadata JSON is not admission proof. Recheck program upgrade authority and mint state before bootstrap. Use one canonical Adapter store; source admin must not repoint a live destination peer to a competing representation.

Fees are not hidden in the curve. Four.Meme's Core FeeRouter policy and module author sharing are the proposed commercial mechanism; a zero-extra-protocol-fee local reference avoids inventing unpublished configuration. An agreed total fee ceiling (e.g. 300 bps) must be enforced where Core exposes the actual total; this version's validator cannot read outer anti-sniper/presale or private fee configuration. Do not present it as doing so.

Security reporting contact: **submission team to fill**. Audit report: **not performed**. Mainnet addresses: **none**. Required release gates are in FOURMEME_REVIEW_CHECKLIST.md.
