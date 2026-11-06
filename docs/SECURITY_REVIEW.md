# OpenFour module defensive review

- Date: 2026-11-06 UTC.
- Scope: owned bridge, source registry, token, schema-aware token module, curve, migration, Pancake adapter and preset validator under developer/startup/contracts; matching tests, encoding helpers and preset composition. InitializationAuth/BnbEnvironment were also reviewed as security boundaries.
- Excluded: unpublished Core/Registry/FeeRouter/CreateDeployer implementations and unchanged third-party dependencies. Their behavior was integration-tested, not audited.
- Fork Registry: 0xaBdEE25230e506cD3527dfb905be17c5E2b07804 on ephemeral localhost chain 31337, forked from BNB testnet block 141062182. Not a public deployment.
- Preset: 2026110502; module keys/tag sources in OPENFOUR_INTEGRATION.md.
- This is an AI-assisted defensive review, not an independent audit or security certification.

## Invariants

- Zero initial issuance; only the per-token bridge mints/burns. Bootstrap is exact, authenticated, bound to the vault/depositor/deposit identifier and processed once.
- BNB is the sole destination; endpoint/source EIDs match environment. Public bridging is closed until both migration completion and final phase.
- Trading reserve follows F(x), never virtual liquidity. Validator bounds inventory and migration reserves; runtime rechecks actual custody.
- Only Core executes migration. Initializers run once through Core or its authorized CreateDeployer and bind the correct token/module.
- Prepared pool has no token inventory or LP before migration. Initial funding uses exact bounded amounts; LP delivery and final balances/reserves are verified. Quote donations remain with LP.
- Price signatures bind chain/verifier/token/identity and freshness; create signatures separately bind chain/caller/full arguments.
- Post-migration pool tax is fixed at 15 bps, with the existing fixed recipient; wallet transfers and bridge mint/burn remain untaxed.

## Findings and fixes

### [H, fixed] Current CreateDeployer initialization was rejected
- Location: ExpansionCurveModule.init and ExpansionMigrateModule.init.
- Condition: current OpenFour delegates initialization to its CreateDeployer, while the old modules admitted only Core.
- Impact: valid launches could not be created through current Core.
- Fix: accept the Core or Registry-authorized CreateDeployer, require matching token/module binding, retain Core-only runtime migration. Verified against real Core/CreateDeployer and initializer-lock tests.

### [M, fixed] Pre-created pair could permanently block graduation
- Location: PancakeV2ExpansionAdapter and migration initialization.
- Condition: the old adapter rejected every existing pair, even one with no LP or inventory.
- Impact: an otherwise valid launch could fail migration.
- Fix: prepare/reuse the empty pair and register it before any token supply. Pre-graduation pool token transfers are blocked. Direct pair funding/mint handles quote-only donations; actual reserves and LP balance are checked. Real Pancake fork covers empty pre-creation and synced donation.

### [M, fixed] Missing schema and stale integration encodings
- Location: ExpansionTokenModule, vendored interfaces, scripts/openfour/encoding.mjs.
- Condition: the standard token module exposed no bootstrap schema; old creation and trade tuples differed from current Core.
- Impact: generic creation tooling could encode incomplete or incompatible requests.
- Fix: publish all bootstrap fields, consume current partner/revertData/vault interfaces, use schema-derived encoding and domain-bound signing. Tools discovery and real creation pass.

### [M, unresolved] Failed launch has no cancellation/repricing recovery
- Location: ExpansionToken.activate and closed pre-migration bridge lifecycle.
- Condition: funded inventory can remain inactive if a fresh observation no longer matches fixed P0, or a launch never graduates.
- Impact: backing can remain locked indefinitely; no owner refund is provided.
- Fix required before production: agree and independently review a recovery design preserving outstanding holder claims. No unreviewed escape withdrawal was added. This risk has not been accepted for production.

### [M, deployment policy] Outer creation flags are outside validator input
- Location: CreateTokenArgs / ExpansionPresetValidator boundary.
- Condition: public validation receives TokenInitParams, not antiSniperEnabled or presaleQuote.
- Impact: a production signer issuing nonconforming requests could change fee behavior or cause creation to fail.
- Control: supplied encoder rejects presale and anti-sniper. Production signing service must enforce the same policy, with final tests before registration. This is a signer trust boundary, not permissionless on-chain enforcement.

### [I] Governance and oracle remain trusted
- Registry-managed module beacons and Core upgrades can change behavior. Fixed constructor values do not make that composition immutable.
- Registrar/source governance and LayerZero verification/configuration can compromise backing; EVM counters cannot independently prove Solana custody.
- A trusted price signer can misprice or deny activation. This integration does not implement an independent market-data collector.
- Quote-only pool donations can increase opening price. They do not entitle the donor to LP; docs and UI must disclose that behavior.

## Checklist assessment

Initialization, descriptors/raw params, token binding, reserve/quote bounds, reverse quotes, migration revalidation, LP/custody checks, base-token inheritance and unused CustomData are covered by review and tests. StandardVault and SimpleTradeModule are reused; no new custody or trade module was introduced. Operational tools reject production-network writes. Source EIDs and destination endpoint identity are checked on chain. Tests cover unauthorized issuance, replay, phase restrictions, rollback, reserve consistency and actual Core/Pancake lifecycle.

## Residual risk

No live Solana BPF/escrow or actual LayerZero DVN delivery was executed. The fork uses fixture source admission and a mock transport. Additional liquidity-operation/callback tests, public deployment verification, role/configuration review, source-to-redemption reconciliation, monitoring, recovery policy and independent audit remain necessary. Passing tests do not establish economic demand or complete security.

## Verdict

- Development integration: Pass for the documented test scope; no unresolved Critical/High issue identified in this scoped review.
- Production / official submission: Fail release gate until the unresolved Medium recovery/policy issues and live validation are resolved.
- Ready for official submit: no. GitHub publication is an engineering handoff, not official registration or production approval.
