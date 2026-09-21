# Threat model and evidence limits

Assets: canonical source escrow/TVL, backed destination supply, accumulated user WBNB, migration inventory and LP ownership. Adversaries include arbitrary traders, creators, source holders, malicious asset programs, replaying relayers, oracle/registrar compromise, compromised governance and DVNs. Chain finality and honest verification of the approved source program are assumptions.

| Failure / attack | Control | Evidence or remaining requirement |
|---|---|---|
| Source balance below TVL | Canonical Adapter accounting; monitor actual balance vs TVL; reject unsupported mint behavior | Inspected stock Rust; **SVM execution and live reconciliation not run** |
| Duplicate delivery / bootstrap replay | Endpoint peer authentication/clear; explicit GUID map; exact one-time funded flag | Executed EVM endpoint-double tests; real endpoint clearing must be tested on testnet |
| Wrong EID, peer, depositor, mint | Fixed EID/peer; source registry enrollment; bound identity; exact bootstrap source signer | Executed packet rejection; source admission evidence is trusted, not cryptographic Solana proof |
| Arbitrary BNB mint/burn | Token grants only its immutable deployed adapter | Executed unauthorized calls; compiler checks actual LayerZero mint/burn interface |
| Native mint vs Adapter confusion | Source helper checks Adapter type, store/mint/escrow, rate and roles | SDK helper tested for builder and precision; RPC-backed full preflight pending |
| Token-2022 / transfer-fee token | Reject all Token-2022 at MVP admission; require legacy immutable/freeze-free mint and WBNB quote | Executed admission policy tests; no claim to support extension semantics |
| Decimal/rounding overflow | Six SD; uint64 source bounds; exact bootstrap normalization; standard OFT dust removal | Executed source helper and real EVM OFT debit tests |
| Manipulated/stale price | External multi-pool observation policy, short TTL, immutable signer and exact P0 | Signature, staleness, eligibility and price rejection executed; source manipulation resistance is an operational assumption |
| Signer compromise | Signer cannot mint or change an active curve; can deny/misprice activation | Privilege analysis; signer rotation needs a new verifier/preset version |
| Registrar compromise | Entries immutable; enrollment not equivalent to source consensus proof | Can admit an unsafe NEW asset; needs independent multisig review and evidence hash |
| Early public bridge enabled | Destination rejects every extra inbound packet and all outbound sends until migration | Executed negative tests; early source unpause can still lock users' source funds pending later delivery |
| External inventory sold into curve | Only exact bootstrap supply exists; entire bootstrap to vault; surplus inaccessible until migration | Executed pre-migration imports rejected, ordinary transfer and resale accepted; no receipt needed |
| Sell > actual BNB / virtual payout | Potential-difference quotes; x bound; exact real-reserve consistency; StandardVault underflow check | Executed reserve and randomized sequence assertions; virtual state has no withdrawal function |
| Graduation insufficient inventory | Validator and runtime balance/LP reserve checks | Parameter sweep rejects bad splits; runtime contracts enforce amount caps |
| Migration failure, retry, double run | Executed flag before interaction; transaction rollback; both phase and completion proof | Executed failed router call, rollback, retry and second execution rejection |
| Unexpected packet phase / delayed message | Unfunded exact bootstrap only, active public closed, migrated standard 40-byte packets only | Executed phase tests; bad compose/bootstrap packets do not become public packets automatically |
| Project cancel/owner quote drain | No cancel, refund or withdrawal method in new contracts; standard custody roles | Unauthorized vault withdrawal executed. No normal cancellation is implemented, including before first trade |
| Core abuse | StandardVault trusts Core to transfer quote | **Cannot be solved by this module integration**; Four.Meme/Core audit gate |
| Reentrancy | Fixed non-hook ERC20; migration flag; adapter ReentrancyGuard; Core harness nonReentrant | Structural controls; dedicated malicious-router callback campaign still required |
| Malicious/fee-on-transfer ERC20 | Fixed derived token; registered WBNB; adapter balance deltas and exact amounts | Source policy tests; adversarial quote-token campaign not executed because non-WBNB quote is disallowed |
| Pause/unpause abuse | Pause cannot transfer collateral; publicMode is independent of owner | Executed access/pause checks; delegate can censor indefinitely, source upgrader can do worse |
| DVN/configuration compromise | Explicit per-direction ULN/confirmations, immutable peer, monitored configuration | **Residual trust**: compromised verification can fabricate accepted messages; no local test proves otherwise |
| Source emergency | Pause new debit/credit; preserve escrow/TVL; retry verified messages | Operational drill on devnet pending; do not unlock collateral manually |
| Destination emergency | Pause adapter; use Core pause if needed; keep supply/backing unchanged | Local bridge pause tested; platform-specific Core pause path unverified |
| Front-run V2 pair creation | Fresh-pair-only adapter refuses pre-existing pools | Safe denial of migration possible; production must resolve with Four.Meme approved migration strategy |
| Initialization front-running | Clone+initialize atomically through Core; implementation initializers disabled | Local clone path executed; production deployer ordering is an explicit gate |

## Formal statements

Let E be normalized source TVL, S total destination minted supply over the authorized mesh, I pending source→destination credit, and O pending destination→source unlock. Under honest approved Adapter and message verification: `S + I + O <= E`, with equality absent intentionally retained surplus/donations. The simpler `S <= E` holds at each completed chain transaction; observers must compare finalized views and account for pending messages.

During the launch, `0 <= x <= G`, `realReserve = F(x)`, `buyPayment = F(x+a)-F(x)`, `grossSell = F(x)-F(x-a) <= F(x)`, `virtualReserve` is not a transferable asset, `bootstrapCredit` is either zero or exactly D, and migration can execute once. If net raised accounting or token balance diverges, trading/migration fail closed.

The economics sweep is a deterministic finite test grid, not a formal proof over every uint256 or a guarantee of demand. The algebraic telescoping proof applies to admitted integer states; implementation correctness still requires independent audit.

## Outstanding attacks to execute before production

Real Solana Adapter CPI rollback/escrow/TVL tests; real EndpointV2 payload verification and retry; actual PCS V2 factory/router fork tests including pool front-running and minimum liquidity; malicious adapter/router callbacks; fee routing and anti-sniper exclusion in real Core; configuration/DVN compromise drills; source program upgrade governance; full network end-to-end deposit through return unlock. These are explicitly not counted as passing tests.
