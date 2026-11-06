# BNB OpenFour Expansion

Existing Solana inventory backs a token launched through OpenFour on **BNB Chain only**. Buyers fund the WBNB reserve; graduation seeds PancakeSwap V2, returns unused inventory to the fixed beneficiary, and enables public OFT bridging. Solana remains the source of backing, not another launch destination.

Version 0.2.0 integrates OpenFour docs commit `6f7efd5d3f14ed280cf471f70675ffba6d319943`. It uses Hardhat, solc 0.8.24, optimizer 200 and viaIR. Custom modules live in `developer/startup/contracts`; unchanged public interfaces and examples are hash-locked under `developer/startup/vendor/openfour`.

## Run

```sh
npm ci
npm test
npm run lint
node scripts/verify-upstream.mjs
npm ci --prefix solana --legacy-peer-deps
npm test --prefix solana
npm run test:fork
```

Node 22.14.0 is supported. The ordinary suite is offline after installation. The fork test reads the public BNB testnet RPC, deploys developer-owned proxies **only on localhost**, registers the preset, and exercises real OpenFour/Pancake implementations. It uses an ephemeral local signer and mocked LayerZero transport. No wallet or public-chain funds are needed. Set `BSC_TESTNET_RPC_URL` or `BSC_FORK_BLOCK` to override the public source/block. See [deployment](docs/DEPLOYMENT.md) and [test evidence](docs/TEST_REPORT.md).

## Composition

- Reuse OpenFour Core, Registry, CreateDeployer, Tools, FeeRouter, StandardVault and SimpleTradeModule.
- Extend OpenFourToken with zero initial mint, bridge-only issuance, signed activation and the existing 0.15% post-graduation pool transfer tax.
- Use ExpansionTokenModule for initialization plus discoverable bootstrap fields, ExpansionCurveModule for the reserve curve, and ExpansionMigrateModule for bounded migration and inventory return.
- Prepare and register the Pancake pair during creation, before inventory exists. An empty pre-created pair is accepted; token deposits into that pool are blocked before graduation. Quote-only donations accrue to the LP and increase the opening quote/token ratio.

The unchanged tax recipient is `0x2b057980e924B2aA8f6B80Bb5c8A669EE3753dc1`. Tax is paid in the expansion token and also applies to later liquidity additions/removals. See [tax policy](docs/POOL_TAX.md).

## Review

Start with [integration and parameters](docs/OPENFOUR_INTEGRATION.md), [technical specification](docs/TECHNICAL_SPEC.md), [architecture](docs/ARCHITECTURE.md), [defensive review](docs/SECURITY_REVIEW.md), and the [release checklist](docs/FOURMEME_REVIEW_CHECKLIST.md). [Source provenance](docs/RESEARCH.md) and [LayerZero operations](docs/LAYERZERO_INTEGRATION.md) describe the external dependencies.

This is an unaudited development integration. Live Solana custody, LayerZero delivery, public deployment, official registration and independent audit remain release gates. Failed launches have no cancellation/repricing recovery. Core/Registry upgrades, source governance, registrar, oracle and endpoint configuration are explicit trust boundaries. See [security policy](docs/SECURITY.md). No other destination chain is supported.

New code: MIT. Upstream licenses and notices remain in force; see [NOTICE](NOTICE).
