# Engineer questions

1. **What are we building?** Backed cross-chain expansion for existing tokens through OpenFour.
2. **Why not another launchpad?** No standalone creation/trading/discovery infrastructure replaces Core; modules execute inside its lifecycle.
3. **What does LayerZero do?** Authenticated OFT messaging and canonical debit/credit mechanics under configured DVN trust.
4. **What does our protocol do?** Source admission/custody operations, bridge configuration, bootstrap restrictions, price/eligibility activation, backing monitoring and expansion-specific integration.
5. **What does OpenFour do?** Deploy module/token instances, trade and fee orchestration, vault custody, discovery and migration coordination.
6. **Reused modules?** StandardVault and SimpleTradeModule from the developer-owned OpenFour fork; Core/Registry remain Four.Meme's.
7. **New modules?** Token implementation, schema-aware ExpansionTokenModule, curve, migration and validator; bridge, factory, registry and verifier are outside OpenFour module orchestration.
8. **Why new?** Token must prevent initial unbacked mint; price and migration fallbacks supply publicly testable behavior absent unpublished standard source; validator checks composition.
9. **How does SPL become BNB?** Solana Adapter locks existing SPL, verified packet causes bridge-only mint of the OpenFour representation.
10. **Who mints?** Only the destination's dedicated OFT adapter.
11. **Supply conservation?** Lock precedes mint; burn precedes unlock; dust remains source-side; include in-flight claims and entire mesh in reconciliation.
12. **Project deposit?** One atomic paused-store bootstrap transaction sends exact D to the fixed destination vault.
13. **Initial price?** PsourceUSD/PbnbUSD, signed fresh observation matching fixed curve P0.
14. **Virtual liquidity?** Pricing parameters V and B0; neither is redeemable collateral.
15. **Real BNB source?** Net purchases through OpenFour, held as WBNB.
16. **Can sellers withdraw virtual BNB?** No; potential differences and real reserve bounds limit payout.
17. **How prevent source-holder drain?** Only the exact bootstrap is credited pre-graduation; every extra inbound and every outbound transfer is blocked.
18. **CurveReceipt?** Removed under this supply and phase restriction. Wallet transfers preserve ordinary token sellability.
19. **Public bridging?** Destination opens after successful migration and final Core phase; source separately unpauses after finalized proof.
20. **Graduation trigger?** Sale remainder <=1e18, matching the reference StandardVault sold-out convention, and exact reserve consistency.
21. **LP creation?** Approved V2 adapter pairs actual WBNB with bounded token inventory; Core owns orchestration.
22. **Unused tokens?** Return to fixed beneficiary atomically during successful migration; normal OFT burn/unlock can return them to source afterward.
23. **Failed migration?** Entire transaction reverts, flags and balances roll back, retry is possible. Empty pre-created pairs are accepted. Pair preparation before funding prevents token seeding; quote-only donations accrue to LP.
24. **Failed LayerZero delivery?** Retry same verified packet; no second deposit or manual mint. Source remains locked until valid delivery/recovery.
25. **Bad/stale price?** Wrong signature/domain/price/eligibility or time window fails activation. A compromised valid signer can still misprice; no decentralized oracle claim.
26. **Admin powers?** Admission of new source mappings, OApp security config/pause, source program/config governance, existing Core custody powers; no new owner quote withdrawal or mint grant.
27. **What must Four.Meme register?** Approved token implementation, fallback curve/migrator if needed, validator and preset composition; our side deploys bridge infrastructure.
28. **What maintain afterward?** Existing platform operations, UI fields and module integration; source custody/bridge/oracle operations remain ours.
29. **What tests?** Real EVM compilation/execution, bootstrap/phase/replay/permission/price tests, integer sweep, migration rollback/retry, SDK instruction construction and modeled cross-chain accounting. See coverage gaps.
30. **Reproduce locally?** README commands install locked dependencies, compile and run all reference tests; deployment local command runs through graduation.
31. **Other chains?** BNB is the only launch destination. Solana supplies the backing. Other destinations and source EIDs are rejected by this version.
