# BNB OpenFour integration — 0.2.0

Destination: BNB Chain (56), BNB testnet (97), or local BNB fork (31337). Operational tools allow only 97/31337; the automated lifecycle verifier allows localhost/31337 only. Source: canonical Solana Adapter, EID 30168 for future BNB mainnet or 40168 for BNB testnet. Bridge factories verify destination endpoint EID 30102/40102 respectively. No alternate destination or arbitrary source EID is accepted.

## Composition

| Slot | Implementation | Registry key source |
|---|---|---|
| Token body | ExpansionToken inherits OpenFourToken | token.bnb_expansion_v2 |
| Token module | ExpansionTokenModule; standard initializer with bootstrap schema | module.token.bnb_expansion_v2 |
| Vault | Existing StandardVault | Existing VAULT_BASIC key |
| Curve | ExpansionCurveModule | module.curve.bnb_expansion_v2 |
| Trade | Existing SimpleTradeModule | Existing TRADE_SIMPLE key |
| Migration | ExpansionMigrateModule | module.migrate.bnb_expansion_v2 |
| CustomData | None | Zero hash |

Custom IDs are keccak256 of the UTF-8 key. Module descriptor tag IDs are the first eight hash bytes. Custom version is 0.2.0. The fork preset ID is 2026110502, a development fixture; official assignment is pending. The validator fixes preset ID, WBNB, adapter and LP recipient. The local fork uses a burn recipient for LP.

Current OpenFour instantiates modules through Registry-managed beacons. Registry/Core governance is therefore a continuing trust boundary. Do not describe those modules as immutable clones. Initializers accept Core or its Registry-authorized CreateDeployer and verify their token-module binding; runtime migration remains Core-only. No closed OpenFour implementation source is copied or compiled.

## Creation and schemas

CreateTokenArgs includes `partner` after `antiSniperEnabled`. The full current tuple and domain-bound signing helper are in `scripts/openfour/encoding.mjs`. The creation signature binds the chain, caller and hash of the entire encoded tuple. It is distinct from the price attestation.

The on-chain token module publishes all six fields through `Tools.getPresetEncodeSchemas`:

- tokenParams: (uint32 sourceEid, bytes32 sourcePeer, bytes32 sourceMint, bytes32 depositor, bytes32 depositId, address beneficiary).
- curveParams: (uint256 p0, uint256 virtualTokens).
- migrateParams: (address adapter, address lpRecipient).
- vaultParams, tradeParams and customDataParams: empty bytes.

Base fields: maxSupply=D (initial inventory, not global supply); saleAmount=G; raiseAmount=ceil(B0*G/(V-G)); quoteAsset=WBNB. Presale must be zero and anti-sniper disabled. Our encoding helper enforces these, but the public validator receives only TokenInitParams. The production creation signer must enforce the outer fields too. Post-graduation imports can make totalSupply exceed initial maxSupply; indexers must handle that meaning correctly.

## Lifecycle

1. Core creates an initially empty token/vault and bound modules. Migration initialization creates or reuses the empty Pancake pair and registers it on the token before bootstrap supply exists.
2. Exactly one authenticated bootstrap credits the committed inventory to the vault. Public bridge traffic stays closed.
3. A fresh, eligible price observation matching fixed P0 activates trading. Tools supplies fee-inclusive estimates; Core owns settlement through FeeRouter and StandardVault, including the current vault sell path.
4. Net quote reserve follows the potential F(x). At the sold-out threshold, migration uses actual WBNB and bounded tokens, verifies pool reserves and LP delivery, and returns surplus inventory. Any failure rolls back.
5. Destination public bridging requires both successful migration and final Migrated phase. The source separately unpauses after finality.

Quote-only pool donations, synced or unsynced, are accepted. They accrue to the LP; the opening ratio can be above the undonated curve target. Nonzero token reserves or existing LP supply are rejected. Direct pair funding/minting avoids the router's one-sided reserve quoting failure.

## Verification and release

`npm run test:fork` deploys independent proxies pointing to the public BNB testnet implementations, checks ownership/signer, registers these slots, uses Tools schemas, and exercises creation, funding, activation, buys, sells, migration and taxed Pancake swaps. See [test report](TEST_REPORT.md) and its machine-readable evidence. Source admission and LayerZero transport are explicitly fixtures in this run.

Production still requires official registration, reviewed creation-signing policy, source/DVN configuration, live deposit-to-redemption reconciliation, failed-launch recovery policy and independent audit. No public Registry mutation or official submission is part of the local fork test.

The launch UI needs source identity/evidence, funding and activation status, virtual versus actual liquidity, fees, graduation result and both bridge pause states. Disable trading until active. Use the published schemas rather than a separate hard-coded bootstrap form. See [release checklist](FOURMEME_REVIEW_CHECKLIST.md).
