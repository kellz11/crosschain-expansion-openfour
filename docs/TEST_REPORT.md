# Executed tests — BNB OpenFour 0.2.0

Run date: 2026-11-06 UTC (November 5 US Eastern). Windows, Node 22.14.0, Hardhat 2.29.1, solc 0.8.24, optimizer 200, viaIR, Shanghai EVM.

| Check | Result |
|---|---|
| Clean locked root install | PASS: 623 packages; npm ci --ignore-scripts |
| Compile | PASS: 83 artifact source units; owned runtime sizes below EIP-170 |
| Existing EVM/economics regressions | PASS: 14 tests, zero failures/skips |
| New Hardhat integration boundaries | PASS: 6 tests |
| Solana SDK/policy suite | PASS: 2 tests after clean locked install |
| Actual OpenFour/Pancake local fork | PASS: 20 checks, source BNB testnet block 141062182 |
| Formatting | PASS |
| Upstream integrity | PASS: 39 source files at 6f7efd5d3f14ed280cf471f70675ffba6d319943 |
| Owned-file whitespace/diff check | PASS; unchanged upstream whitespace preserved |

Evidence: [build settings and sizes](reports/build-report.json), [EVM/Hardhat output](reports/evm-test.log), [Solana output](reports/solana-sdk-test.log), [economic grid](reports/economics.json), and [fork assertions/addresses/transactions](reports/openfour-fork.json).

The clean install reproduced Ganache's bundled Darwin-only fsevents metadata problem. That lock entry is marked optional, preserving version/integrity. Windows native uWS/Solana bigint bindings fall back to JavaScript; tests execute successfully. No blanket dependency audit fix or major upgrade was applied.

## Actual integration evidence

The local fork uses the published Registry, Core, CreateDeployer, FeeRouter, Tools, StandardVault and SimpleTradeModule implementations through new developer-owned proxies. It verifies ownership/signer, registers the custom composition, discovers schemas, signs the current partner-bearing tuple, and creates a zero-supply market.

After fixture bootstrap and a signed activation, real Core buys/sells preserve the exact reserve invariant. An empty Pancake pair pre-created before the launch is reused; pre-graduation token deposits fail. A synced quote-only donation is accepted at graduation. Actual pair reserves, LP burn recipient, emptied vault and one-time migration are verified. Current Core treats a repeat migration call as a no-op; the test checks no second migration event or balance change rather than expecting a revert.

The real Pancake fee-on-transfer router executes both post-migration buy and sell paths; tax reaches the fixed recipient. The six new Hardhat tests cover schema ABI order, source EID restriction, locked implementation initializers, unrelated-chain rejection, creation signature/domain/outer-flag constraints, and prevention of repeated token-module creation/metadata overwrite.

## Regression coverage

Existing tests exercise exact bootstrap identity/amount/replay restrictions, unauthorized issuance, stale or invalid attestations, reserve/reverse-quote consistency, seeded Solidity trade sequences, migration rollback/retry, pool-transfer tax rounding/atomicity, OFT dust/burn/pause semantics and modeled cross-chain supply. The finite economic grid covers 2,304 parameter combinations and 114,614 modeled transitions. Solana tests exercise SDK encoding/policy and atomic instruction ordering, not source-chain execution.

## Limits

LayerZero delivery in the fork is mocked; source admission is a fixture. No Solana BPF execution, live escrow/TVL validation, real DVN delivery, funded public deployment or official Registry registration was performed. Additional liquidity-operation/callback checks, creation-signing policy, recovery design and independent security audit remain release gates. All fork addresses and transaction hashes are localhost evidence.

The older local-demo log is historical baseline evidence. GitHub CI results are recorded on the associated change; this report describes the local run and does not substitute for hosted CI.

Reproduce with the [README commands](../README.md). See [defensive review](SECURITY_REVIEW.md) and [release checklist](FOURMEME_REVIEW_CHECKLIST.md).
