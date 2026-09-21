# OpenFour integration and submission

## Compatibility matrix

| Requirement | Existing component | Reuse/custom | Reason / confirmation |
|---|---|---|---|
| Destination ERC20 metadata/module getters/phases | OpenFourToken | Inherit | Preserve standard behavior, suppress unbacked initial mint |
| Token initialization | StandardTokenModule | Reuse unchanged | Calls virtual initialize on selected token implementation |
| Existing destination token market | Core clone flow | Not assumed supported | No public external-token create lifecycle established |
| Backed bridge mint/burn | No OpenFour component | Custom bridge + token extension | Standard LayerZero MintBurnOFTAdapter separates OApp constructor/ownership from token clone |
| Real inventory and quote custody | StandardVault | Reuse unchanged | No special custody semantics needed; inventory arrives after creation |
| Source-valued virtual price/depth | BondingCurveModule | Custom reference fallback | Parameter schema/math unavailable; replace fallback if Four.Meme demonstrates equivalent bounds and initialization |
| Ordinary internal buy/sell | SimpleTradeModule | Reuse requested; mock locally | No receipt, tax or custom trade policy required |
| Platform/protocol fees | Core FeeRouter/module author share | Reuse platform policy | Reference takes no extra protocol fee; cap aggregate fees at reviewed preset/UI level; no claim validator can inspect unavailable Core fee config |
| Graduation | BondingPcsV2MigrateModule | Thin custom fallback | Need measured reserve, safe remainder return, successful-execution signal; production implementation unavailable |
| DEX liquidity | Public V2 migration adapter interface | Implement fallback V2 adapter | Existing adapter may replace only after matching prefunding and LP checks |
| Cross-module persistent state | CustomData | Omit | Bridge stores funding; token stores activation/identity; migration stores execution |
| Cross-module constraints | Preset Validator | New | Fixed quote/adapter/LP policy, decimal, split, reserve and schema consistency |
| Source attestation/discovery | None | Protocol service | Four.Meme does not run source custody or collect Solana price data |

## Proposed registration

Preset name `CrossChainExpansion`; version `0.1.0`; purpose: existing backed assets expanding through OpenFour. Author/website/audit contact must be filled by submitting team. No deployed production addresses exist in this package.

| Slot | Proposed key source/tag | Version |
|---|---|---|
| Token implementation | `token.crosschain_expansion` | 0.1.0 |
| TokenModule | existing `module.token.standard` | Four.Meme registry snapshot |
| Vault | existing `module.vault.standard` | Four.Meme registry snapshot |
| Curve | `module.curve.crosschain_expansion` | 0.1.0 |
| Trade | existing `module.trade.simple` | Four.Meme registry snapshot |
| Migrate | `module.migrate.crosschain_expansion_v2` | 0.1.0 |
| CustomData | zero ID | absent |

`moduleId/tokenImplId = keccak256(UTF8(key source string))`; `tagId = bytes8(keccak256(UTF8(tag)))`. Registry officials determine final IDs. Implemented descriptors take version from initialization. No invented module.data tag exists. `ExpansionPresetValidator` constructor binds the actual assigned preset ID, WBNB, approved migration adapter, LP lock/burn recipient. Local harness uses ID 1 only as a test fixture.

## Exact parameters

Base: maxSupply=D (bootstrap inventory, **not global source supply**); saleAmount=G; raiseAmount=ceil(B0 G/(V−G)); quoteAsset=verified WBNB; tokenSalt/name/symbol/URI per Core schema. Post-graduation totalSupply can exceed initial maxSupply as more canonical source tokens bridge; Four.Meme indexers must not interpret this field as an immutable global cap.

* tokenParams: ABI tuple `(uint32 sourceEid,bytes32 sourcePeer,bytes32 sourceMint,bytes32 depositor,bytes32 depositId,address beneficiary)`.
* curveParams: `(uint256 p0,uint256 virtualTokens)`; 18-decimal price and inventory.
* migrateParams: `(address adapter,address lpRecipient)`.
* vaultParams, tradeParams, customDataParams: empty bytes.
* antiSniperEnabled=false and presaleQuote=0 in outer CreateTokenArgs; these fields are **not available** to the public preset validator. Core/API must enforce them, or extend validator input before production.

The standard TokenModule publishes no custom token-parameter schema. `submission/schemas.json` is the exact token group schema for the small expansion UI extension. Curve and migration schemas are on-chain. Four.Meme must confirm whether Tools can associate this token schema with the selected token implementation, or route this group through its UI integration. We do not falsely claim automatic schema discovery through the unchanged StandardTokenModule.

## Conditions for replacing fallback modules

Curve must allow source-derived arbitrary P0 and depth V, zero initial real quote, exact sale cap, reserve-bounded sells, shared decimal precision, and deterministic migration reserves after fees. Show buy/reverse/sell equivalence and dust behavior. Standard migrator must not destroy backed inventory with a dead-address transfer then release source backing. It must handle <=1-token remainder, pair actual quote with bounded tokens, reconcile unused tokens, preserve atomic retry and expose verifiable success. If it lacks `executed()`, replace the bridge's graduation proof interface through a reviewed bridge version; do not simply point this bridge at a different migrator.

## UI/indexing

Show source mint/store/program/explorer identity, eligibility evidence, attestation age, committed inventory, initial valuation, virtual depth separately from actual WBNB, funding/activation status, curve progress, expected LP/returned inventory, fees, migration result, and both bridge directions' pause/config status. Disable buy/sell buttons while token.active=false even if Core's phase says Trading. Public destination bridge opening and source unpause are separate events. Standard Core handles price quotes, slippage, deadlines, fees and discovery. Our backend provides source evidence and bridge telemetry.

## Submission fields/events/errors

Include source files, lockfiles, hashes, constructor arguments, schemas, expected composition, test logs, known limitations, independent audit status **not audited**, author/contact **to be supplied**, deployment addresses **pending**, and registry review ID **pending**. Events: SourceEnrolled; BridgeCreated; BootstrapCredited; Activated; ExpansionMigrated; BridgePaused; standard OFTSent/OFTReceived and OpenFour token/vault/Core events. Errors use explicit `Source:`, `Factory:`, `Bridge:`, `Token:`, `Oracle:`, `Curve:`, `Migrate:`, `PCS:`, `Validator:` reason prefixes plus upstream custom errors. ABIs generated by compile are authoritative; frontends must decode upstream errors too.
