# BNB OpenFour Expansion — implementation specification v0.2.0

This specification is for a reference implementation, not an audited production release. The old Flap PRD is conceptual background only. There is no new launchpad, independent supply, receipt token, or project-funded BNB liquidity.

## Components and state

The source is one canonical Solana OFT **Adapter** store per SPL mint/mesh. It locks existing tokens; BNB uses burn/mint representation through LayerZero's MintBurnOFTAdapter. The destination token inherits OpenFourToken, suppresses `_mintInitialSupply`, preserves module getters and phases, and delegates mint/burn solely to its adapter. A bridge factory deploys the adapter without putting its bytecode inside the token runtime. SourceRegistry admits only reviewed EID/mint/peer mappings; entries are immutable and carry evidence hashes. The registrar's source review is an explicit trust boundary. Each launch fixes its source EID, OFT store, mint identity, project depositor, deposit identifier, deposit size, endpoint, initial delegate, attestor and beneficiary. OApp owner/delegate security configuration remains governed. No core-specific token symbols or addresses occur in the protocol.

State is Created/Unfunded → Funded/Inactive → Trading/Active → MigratePending → Migrated. Funding and activation are protocol gates independent of Core's phase. Pre-migration inbound credit is exactly one authenticated bootstrap; normal bridging is prohibited in both directions. Transferable curve-bought tokens need no separate sell rights. Inventory sent directly back to the vault is a donation, never new sell capacity.

## Price, eligibility and activation

An immutable EIP-712 attestor contract fixes the trusted signer, maximum observation age, minimum market age and minimum capitalization for a preset version. Production can deploy a replacement verifier behind a new preset version; existing launches do not silently change trust. MVP uses one explicitly trusted signer, not a decentralized oracle. A signature binds chain ID, verifier, token, source mint/EID/store, deposit ID, P0, source USD price, BNB USD price, market cap, market age, observation timestamp, expiry and nonce. Activation consumes the nonce for that token once, after funding. P0 uses 18 decimals and must match the curve's effective rounded starting price within the documented rounding tolerance. No oracle updates reprice a live curve.

Collector policy: observe multiple independent liquid source pools; take a time-weighted median/liquidity-weighted price across a disclosed window; exclude wash volume and low liquidity; bound observation gaps and deviations; use independently collected BNB/USD. Market cap must state circulating vs fully diluted basis. Age is earliest verified public trading history, not just a mint timestamp. The collection service is a trusted off-chain input and cannot be made manipulation-proof merely by signatures. A sample attestation tool signs supplied reviewed observations; it does not manufacture market data. Configurable default policy is age >180 days and capitalization >$500,000. Reject legacy SPL tokens with live freeze/mint privileges under the MVP asset admission policy, and reject all Token-2022 tokens initially (rather than pretending every extension is supported).

## Curve and real reserve

All destination token/quote arithmetic uses 18 decimals. Let D be funded token inventory, G be the **actual sale cap**, V be virtual token depth, and B0 = ceil(P0 × V / 1e18). Define cumulative reserve potential:

`F(x) = ceil(B0 × x / (V − x))`, for `0 ≤ x ≤ G < V`.

At net sold x, buy a tokens for `F(x+a)−F(x)`; sell a for `F(x)−F(x−a)`. Reject zero-quote trades, sells exceeding x, buys exceeding G, and contexts where real reserve differs from F(x). Reverse quotes use monotone bounded binary search. This potential formulation telescopes exactly in integer arithmetic: splitting trades does not accumulate an unfunded rounding liability. Platform fees are handled by OpenFour outside this net reserve; anti-sniper is disabled. Real quote starts at zero; virtual B0 is never deposited, transferred or withdrawn.

For the inherited conceptual example choose `G=.39D`, `V=3.25D`: this represents selling 60% of the old .65D allocation. The remaining `.61D` is real held inventory, not promised sale capacity. At G, F(G) ≈ .44318 P0 D, spot ≈1.29132 P0, and LP tokens ≈.3432D. Remaining ≈.2668D is returned to the fixed project beneficiary only inside successful migration. This avoids unused-inventory burns to a dead address that leave OFT accounting ambiguous. The beneficiary can bridge the surplus back after graduation using ordinary burn/unlock.

At migration use actual net sold `x = G − remainingForSale`, `B = vault.totalRaised = F(x)`, and `T = floor(B × (V−x)/(B0+B))`. The public StandardVault treats remaining <=1e18 as sold out; require that threshold, `T ≤ D−x`, sufficient actual quote/token balances, fixed adapter/LP recipient and pending phase. The validator bounds V >=2G, so reserved inventory remains sufficient throughout the final dust interval; it checks endpoint solvency at G. The V2 adapter prepares an empty pair during creation, while supply is zero, and registers it before bootstrap. This blocks token transfers into that pool before migration. Empty pre-created pairs are accepted. Quote-only donations, including synced donations, accrue to the LP and increase the opening quote/token ratio above the undonated target. Migration directly funds the pair, mints LP to the fixed recipient and verifies token/quote balances, reserves and LP delta. Nonzero token reserves or LP supply are rejected. Do not pay virtual BNB, assume a fee haircut is zero when it is not, or accept a zero-address migration adapter.

## Atomic migration and public bridge

The migration module checks current vault state rather than trusting hook data. It marks execution before external interactions, transfers only bounded inventory/quote, performs the approved V2 adapter call, registers the pool and returns surplus to the immutable beneficiary. Any failure reverts the entire transaction. A successful migration flag plus Core's final `Migrated` phase enables destination bridging automatically. The source operator verifies finality then unpauses the source store. No cross-chain atomic transition is claimed. Retry the same pending LayerZero message rather than re-depositing. Migration is at most once; public bridge configuration never grants a token mint role to the project.

## Supply invariants and trust

With amounts normalized to shared decimals: `destination totalSupply + in-flight credited claims ≤ canonical source TVL`. Before bootstrap delivery, the claim is in flight and the destination supply is zero. After delivery it becomes supply. Outbound burn reduces supply before source unlock. Dust remains with the sender. Six shared decimals impose uint64 packet bounds; source local units additionally must fit SPL uint64. Never deploy a second independent lockbox for the same canonical representation without a coordinated mesh design.

The EVM cannot independently read Solana custody. This invariant is conditional on the authenticated source program, endpoint verification/DVN assumptions, source program upgrade authority, and endpoint configuration. An authentic-but-false message from a compromised source program/DVN can violate backing; an on-chain counter is not proof otherwise. Monitoring compares source `tvl_ld`, escrow actual balance, destination supply, and in-flight packets. Halting must not unlock source collateral against outstanding supply.

## Permission and failure policy

No owner quote withdrawal exists in new protocol contracts. StandardVault trusts Core and migration module; a compromised Core is outside the protection of a module-only integration. No normal cancellation or project refund after funding/first trade is implemented in v0.2; failed/abandoned launches may remain locked pending an explicitly reviewed recovery version. This favors backing over administrative recovery. Bridge pause stops new debit/credit, not custody withdrawal. Existing OpenFour pause authority remains a platform trust assumption. Fixed peers prevent owner peer replacement; endpoint delegate configuration and Solana upgrade/admin roles remain explicit privileged risks.

## Network scope

BNB is the sole launch destination. Contracts require BNB mainnet (56), BNB testnet (97), or local BNB test forks (31337). Operational scripts reject mainnet. Source EIDs are fixed to Solana 30168/40168 according to destination environment; destination endpoint EIDs must be 30102/40102. Solana is backing infrastructure, not another launch destination. No alternate chain support is included.

See ADR-001 for decisions, THREAT_MODEL for failure coverage, DEPLOYMENT for reproducibility, and FOURMEME_REVIEW_CHECKLIST for gates.

## Post-migration token tax

Registered pool transfers pay 15 bps to the fixed protocol wallet, separately from DEX fees. The tax preserves total supply and leaves initial migration, wallet transfers and bridge mint/burn untaxed. Later liquidity operations are taxed. See [POOL_TAX.md](POOL_TAX.md) for exact arithmetic, recipient and routing requirements.
