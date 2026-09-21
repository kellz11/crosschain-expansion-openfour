# Cross-Chain Expansion Protocol — OpenFour reference

Existing Solana token inventory becomes a backed BNB representation, launches through OpenFour, accumulates real user-funded WBNB, and migrates to PancakeSwap before public OFT bridging opens. **We own cross-chain expansion. Four.Meme remains the launch environment.**

This is a compiling reference for engineering review, not an audited release or completed live integration. No production/testnet addresses were fabricated and no external deployment was made. The actual OpenFour public interfaces are vendored unchanged at commit `0527d529d59c6a3fbc9927ce391ecc97c66e1b01`. LayerZero OFT 4.0.1 is pinned. See [research](docs/RESEARCH.md) for source provenance.

## Run

```sh
npm ci
npm test
npm run lint
npm ci --prefix solana --legacy-peer-deps
npm test --prefix solana
npm run deploy:local
```

Node 22.14.0 recommended. No Foundry installation is required; solc-js compiles the actual Solidity and Ganache executes it. `npm run simulate` reproduces the economic parameter sweep. `npm run format` formats owned Solidity/JS. [Deployment instructions](docs/DEPLOYMENT.md) cover BSC testnet, Solana devnet, source bootstrap and remaining live acceptance tests.

## Review order

1. [Research and pinned source findings](docs/RESEARCH.md).
2. [Compatibility matrix and submission schemas](docs/OPENFOUR_INTEGRATION.md).
3. [Architecture decision record](docs/ADR-001.md).
4. [Technical specification](docs/TECHNICAL_SPEC.md), [responsibilities](docs/ARCHITECTURE.md), [LayerZero flow](docs/LAYERZERO_INTEGRATION.md).
5. [Threat model and coverage gaps](docs/THREAT_MODEL.md), [security policy](docs/SECURITY.md), [test report](docs/TEST_REPORT.md).
6. [What Four.Meme actually has to do](docs/FOURMEME_REVIEW_CHECKLIST.md).

The [engineer FAQ](docs/ENGINEER_FAQ.md) answers all 31 requested integration questions. The executed suite includes 13 EVM/economic tests and 2 Solana SDK tests; live network and production-Core validation remain pending.

## Composition

Reuse StandardTokenModule and StandardVault. Request standard SimpleTradeModule in production (local test double because source is not public). Extend OpenFourToken with bridge-only mint/burn and a zero initial mint. Use a per-launch MintBurnOFTAdapter, source admission registry, signed activation verifier and dedicated preset validator. Reference curve and V2 migration modules are fallbacks pending inspection of Four.Meme's unpublished bonding implementations. No new custody vault, receipt token, independent launchpad, protocol token or hard-coded source asset.

## Material limits

OpenFour production Core/Registry and standard bonding modules are not public. Internal approval is needed for zero-supply creation with asynchronous inventory funding, exact fee/phase behavior, token schema routing and LP policy. Local endpoint/router doubles do not validate DVNs or a live PancakeSwap deployment. Solana tooling imports/tests the actual SDK but the BPF program was not built/executed here. The source price collector and signer are explicitly trusted. Source/endpoint configuration and source upgrade authority remain material bridge risks. The reference has no cancellation/repricing recovery, and its fresh-pair-only V2 fallback can be blocked by pre-creation of the pair. These are release gates, not claims of completed production support.

New code: MIT. Upstream dependency licenses and source notices remain in force; see [NOTICE](NOTICE).
