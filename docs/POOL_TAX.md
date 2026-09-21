# Pool token tax

The expansion token charges **0.15% (15 basis points)** on transfers involving a registered migrated pool, after graduation. This replaces the proposed 1% total fee / 0.25% protocol allocation; neither of those proposed rates is implemented.

Recipient: `0x2b057980e924B2aA8f6B80Bb5c8A669EE3753dc1`.

The rate and recipient are public Solidity constants with no setter. Each token clone using this implementation uses the same policy. Fees arrive directly in the expansion token being traded, not automatically converted to BNB or stablecoins. No external recipient callback or automatic fee-selling transaction is needed.

For a gross token transfer A, `tax = floor(A * 15 / 10000)`. The sender spends A; the recipient receives A minus tax; the fee wallet receives tax. A 1,000-token transfer pays 1.5 tokens. Rounding is in the token's smallest units; very small transfers may round to zero. No tokens are minted or burned by the tax. Both transfer and transferFrom apply it, and allowance is consumed on the gross amount. A pool-to-pool transfer is charged once per transfer.

## Scope

- Buys from and sells into the registered migrated pool are taxed in token units.
- Later liquidity additions, removals, and other transfers involving that pool are also taxed. ERC20 transfers cannot reliably distinguish these from swaps.
- Initial migration liquidity is untaxed because migration completes before the token enters its Migrated phase. Bonding-curve trades, ordinary wallet transfers, and bridge mint/burn are untaxed.
- Pools not registered by the migration module, source-chain markets, and unrelated existing tokens/pools are not covered. The current migrator registers only its newly created destination pool. Updating repository source does not change any previously deployed immutable implementation.
- PancakeSwap's own swap fee is additional and unchanged. There is no guaranteed 1% total fee and no new launchpad/creator allocation in this change.

## Integration and acceptance

Use fee-on-transfer-compatible V2 swap routes and net-received slippage checks. Exact-output routes and liquidity UIs that assume tax-free transfers may fail or misquote. Initial migration still uses exact input checks; post-migration liquidity operations need separate fee-aware handling.

Local tests execute the Solidity tax on both pool transfer directions, transferFrom, rounding boundaries, failed-transfer rollback, wallet transfers, migration and OFT operations. The pool test double does not implement PancakeSwap's AMM invariant. Actual PancakeSwap router/factory fork tests, real Core integration, liquidity UI compatibility and independent audit remain release gates; local success does not establish live swap compatibility.
