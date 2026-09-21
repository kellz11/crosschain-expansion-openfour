# Executed test report

Run date: 2026-09-20 UTC (September 19 US Eastern). Environment: Windows, Node 22.14.0, npm 10.9.2, solc-js `0.8.30+commit.73712a01.Emscripten.clang`, Ganache 7.9.2, Shanghai EVM, optimizer 200/viaIR.

| Check | Observed result |
|---|---|
| Compile actual owned code and upstream dependency closure | PASS; 75 Solidity source units, all new runtimes below 24,576 bytes |
| EVM / economics suite | PASS: 13 tests, 0 failed, 0 skipped; ~50.2 seconds |
| Solana SDK/policy suite | PASS: 2 tests, 0 failed, 0 skipped |
| Integer economic grid | 2,304 parameter combinations; 1,152 admitted and 1,152 rejected; 114,614 modeled trade transitions |
| Deployed Solidity randomized curve test | 48 seeded buy/sell operations plus exact reserve, reverse-quote and round-trip assertions |
| Cross-chain supply model | 12 post-graduation lock/mint/burn/unlock cycles with explicit pending claims; modeled source, actual EVM OFT logic |
| Ephemeral local demo | PASS: bootstrap → activate → trade → migration → publicMode=true |
| Format check | PASS |
| Vendored source integrity | PASS: 38 unchanged OpenFour Solidity files checked against manifest |
| Fresh root dependency install | PASS: npm ci in empty reproduction directory, 410 packages |
| Fresh Solana dependency install | PASS: npm ci in empty reproduction directory, 423 packages |

The clean-install test found Ganache's bundled macOS-only `fsevents` entry incorrectly marked as non-optional. Its lockfile entry is marked optional, preserving the published version/integrity hash. Both clean installs then succeeded. Re-resolving dependencies with npm install may recreate the upstream packaging issue; use the supplied locks and npm ci.

The first EVM test run caught a missing boolean return in the token's LayerZero mint/burn interface. The token now explicitly inherits IMintableBurnable, the ABI was corrected, and all affected tests were rerun. Initial simulation-test count thresholds were corrected by expanding the grid, not by claiming unexecuted cases. Final evidence logs are under reports/.

## What these results establish

Public OpenFour interface compilation; clone initialization through the reference lifecycle; no initial mint; source admission and caller checks; bootstrap cap/recipient/depositor/domain/replay constraints; signature/price/age/cap/time validation; receipt-free transfers and resale; bounded real quote; source-closed bridge phases; migration rollback/retry/one-time completion; LP recipient checks against a router double; inherited OFT burn/dust semantics; source SDK atomic instruction ordering and unsupported-asset rejection.

## What was not executed

Actual OpenFour production Core/Registry; real PancakeSwap router/factory fork; real EndpointV2 verification/DVN delivery; Solana BPF build or SVM tests; funded devnet/BSC testnet transactions; source-price collection service; adversarial callback/fee-on-transfer campaign; independent security audit; hosted GitHub CI. Source backing assertions in the local cross-chain test use an explicitly modeled ledger, not fabricated Solana chain data. The supplied CI workflow has not run on GitHub.

Local test success is not an audit or proof of live compatibility. See THREAT_MODEL.md for the per-failure evidence table and FOURMEME_REVIEW_CHECKLIST.md for release gates.
