# Four.Meme review package — BNBExpansion 0.2.0

The current code integrates the published OpenFour BNB testnet implementations through a developer-owned local fork. BNB is the only launch destination; Solana provides backing.

## Verified in the developer-owned fork

- [x] Core creates the custom token with zero initial supply.
- [x] CreateDeployer initializes and binds the custom modules.
- [x] Tools discovers all six token bootstrap fields.
- [x] Unfunded trading fails; exact fixture bootstrap funds the real StandardVault.
- [x] Real Core/FeeRouter buy and sell settlement preserve F(x).
- [x] Empty pre-created Pancake pair is reused and registered before funding.
- [x] Pre-graduation token transfer into the pool fails.
- [x] Synced WBNB-only donation does not block migration.
- [x] Graduation verifies actual reserves, LP recipient, emptied vault and one-time execution.
- [x] Real Pancake fee-on-transfer buy/sell paths collect the existing 0.15% token tax.

See [machine-readable fork evidence](reports/openfour-fork.json). These are local-fork results, not live LayerZero or Solana execution.

## Before official registration / production

- [ ] Agree creation signer policy: presaleQuote=0, antiSniperEnabled=false, permitted partner and aggregate fees. The public validator does not receive those outer fields.
- [ ] Approve LP destination, pool donation behavior and the fixed tax recipient. Later liquidity additions/removals are taxed and need additional acceptance tests.
- [ ] Approve maxSupply as initial inventory; post-migration imports can increase supply.
- [ ] Review Registry/Core beacon and upgrade governance.
- [ ] Agree failed-launch recovery policy; this version has no cancellation/refund/repricing route.
- [ ] Complete independent security audit and remaining callback/liquidity-operation tests.
- [ ] Verify real source mint/program/store/escrow/TVL and governance.
- [ ] Review both LayerZero directions: peer, DVN, libraries, confirmations, executor, options and source unpause.
- [ ] Run live devnet/testnet deposit, delivery/retry, graduation and redemption; reconcile all finalized supply and pending claims.
- [ ] Provide production funding/activation/bridge-state UI and monitoring.
- [ ] Supply author/contact, public review deployment, audit link and official preset ID.

Our team operates source custody, admission, attestations, bridge configuration and monitoring. OpenFour owns its platform governance, trading, fees, vault and official registration. No official Registry writes or production deployment were performed.
