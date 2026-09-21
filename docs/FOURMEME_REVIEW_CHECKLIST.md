# Four.Meme review package — CrossChainExpansion 0.1.0

## What Four.Meme actually has to do

1. Review the token extension, OFT boundary, fallback curve/migration modules, validator, schemas and test evidence.
2. Confirm the public lifecycle matches internal Core behavior, especially asynchronous funding, disabled anti-sniper/presale, fee accounting and atomic migration retry.
3. Supply/register reviewed standard module versions and the approved Expansion Preset; replace fallback curve/migration modules only after equivalence tests pass.
4. Add source identity, funding/activation, token-parameter schema and bridge-state fields to existing launch UI/discovery.
5. Run the supplied local suite and the shared testnet acceptance procedure using internal Core/Registry and the supported PancakeSwap/LP policy.

Our team operates source custody, admission, price attestations, LayerZero security configuration, source bootstrap and bridge monitoring. Four.Meme continues its existing Core, trading, fee and migration operations.

## Blocking acceptance checks

- [ ] Internal Core supports token creation with zero supply and later vault credit without independent minting.
- [ ] Inactive created markets cannot be bought through alternative quote/trade paths; UI displays the funding gate.
- [ ] Standard TokenModule can receive the supplied tokenParams and Tools/UI schema routing is agreed.
- [ ] maxSupply means initial inventory for this token type; post-migration OFT imports are not incorrectly blocked/indexed.
- [ ] Core enforces antiSniperEnabled=false, presaleQuote=0 and agreed aggregate fee maximum outside the public validator input.
- [ ] StandardVault sell accounting matches potential F(x) after actual Core fee handling.
- [ ] Review the fixed 0.15% post-migration [pool token tax](POOL_TAX.md), recipient wallet and fee-on-transfer-compatible routing/slippage. Test buys, sells and later liquidity additions/removals against the actual PancakeSwap router; show the tax separately from DEX fees.
- [ ] Production sold-out threshold is confirmed; reference uses <=1e18 remainder.
- [ ] Internal migrator/adapter availability reviewed; V2 vs Infinity target and LP lock/burn policy approved.
- [ ] Fresh-pair front-running/DoS handled by supported production migration implementation or accepted as a release blocker.
- [ ] Real Core calls initialize/phase/migration in an atomic transaction and permits retry after failure.
- [ ] Code/source verification, independent audit, adversarial callback/fee tests and actual PCS fork tests completed.
- [ ] Source mint/program/escrow/TVL verified; source role and upgrade authority policy approved.
- [ ] Source↔BNB DVN/library/confirmation/executor configuration reviewed, including malicious configuration threat.
- [ ] Real devnet/testnet escrow, delivery, retry, graduation, source unpause and return unlock executed and reconciled.
- [ ] Failed-launch recovery policy agreed: this reference has no cancellation/refund/repricing route.
- [ ] Author/contact, audit link, submission ID and deployment addresses filled.

## Review conclusion

The package demonstrates a compiling, locally tested minimum public-interface integration. It does not establish production compatibility or a completed network integration. The largest unresolved question is Core's asynchronous zero-supply lifecycle; resolving it is more valuable than adding a custom custody module. Source and endpoint trust risks remain even when every local test passes.
