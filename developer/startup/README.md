# BNB Expansion startup

Run commands from the repository root: `npm ci`, `npm test`, then `npm run test:fork` for actual OpenFour/Pancake integration on a local BNB testnet fork.

- `contracts/`: owned token, bridge, curve, migration, validator and test doubles.
- `vendor/openfour/`: unchanged public dependency snapshot with source-path/hash manifest.
- `hardhat.config.cjs`: pinned solc 0.8.24, optimizer 200, viaIR and Shanghai target.
- `test/`: Hardhat integration-boundary regression tests; broader economic/OFT tests are in root `test/`.
- `scripts/verify-fork.cjs`: owned Registry registration and actual Core/Pancake lifecycle verification on localhost only.
- `presets/bnb-expansion.json`: network scope and module composition.

The fork toolkit reuses deployed OpenFour implementations; it does not compile closed platform source. See [integration](../../docs/OPENFOUR_INTEGRATION.md), [test report](../../docs/TEST_REPORT.md), and [submission package](../../submission/README.md).
