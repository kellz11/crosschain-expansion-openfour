# Reproduce and deploy

## Local verified path

Node 22.14.0, npm 10.9.2 were used on Windows. Commands are portable shell commands (use `npm.cmd` in PowerShell if script execution policy blocks npm.ps1).

```sh
npm ci
npm run lint
npm test
npm ci --prefix solana --legacy-peer-deps
npm test --prefix solana
npm run deploy:local
```

Compilation uses locked solc-js 0.8.30, optimizer 200, viaIR, Shanghai target; no compiler download occurs during build. `artifacts/build-report.json` reports source count and EIP-170 runtime size checks. OpenFour public interfaces, OpenFourToken, StandardTokenModule and StandardVault compile from unchanged vendored source. Test doubles exist only under contracts/mocks and are visibly named. Local tests use real LayerZero OFT contract logic but mocked endpoint transport and PCS router. They do **not** execute Solana BPF or real DVN verification.

The npm legacy-peer-deps setting is intentional: LayerZero's broad message-library peer graph includes unrelated ethers-v5 tooling, while this harness uses ethers v6. Every installed package is resolved in package-lock; the Solidity dependency closure compiles. Solana's transitive aptos-client peer `got` is explicitly pinned to 11.8.6. Native optional Ganache/uWS and Solana bigint bindings fall back to JavaScript on this Windows/Node build; tests still execute. CI is supplied but no hosted GitHub run is claimed.

Ganache's bundled Darwin-only fsevents lock entry is explicitly marked optional to make npm ci portable; its version and integrity hash are unchanged. Clean root and Solana installs were both executed from empty reproduction directories. Run `node scripts/verify-upstream.mjs` to check the vendored source manifest.

## BSC testnet

The official metadata snapshot supplies BSC chain ID 97, EID 40102, EndpointV2 `0x6edce65403992e310a62460808c4b910d972f10f`. Refresh with `node scripts/configure/refresh-metadata.mjs`, review the diff and verify endpoint.eid/code on the actual RPC. Fill deployments/example/testnet.json with independently verified WBNB, PCS V2 router, multisig roles, signer and approved LP recipient. No placeholder is silently accepted.

```sh
# Configure BSC_TESTNET_RPC_URL and DEPLOYER_ADDRESS in the process environment.
# DEPLOYER_ADDRESS must be available through your external test signer RPC.
npm run compile
node scripts/deploy/testnet.mjs deployments/example/testnet.json
```

This deploys our implementation contracts, source registry and validator, writes addresses/transaction hashes incrementally, and does not deploy or register a fake production Core. Four.Meme assigns the actual preset ID and standard module versions. If they provide no OpenFour test instance, use MockCore on a private test network explicitly labelled as a harness; it is not a Four.Meme deployment. Public testnet integration needs their creation/API authorization and registry configuration.

## Solana devnet

Official metadata maps `solana-testnet` to **Solana devnet**, EID 40168 and Endpoint program `76y77prsiCMvXMjuoZ5VRrhG5qYBrUMYTE5WgHqgjEn6`. Do not substitute Solana's distinct testnet cluster.

Fetch the pinned full LayerZero workspace using `node solana/fetch-upstream.mjs`; unpack work/layerzero-devtools.zip and work from examples/oft-solana. Follow its pinned README to install the monorepo dependencies and build/deploy the unmodified OFT program. Anchor.toml pins Anchor 0.31.1. Its Cargo.lock/source snapshot determine Rust dependencies; set the deployment's own program ID before rebuilding. This deliverable deliberately does not introduce a custom escrow program. Rust/Anchor/Solana CLI were not installed in the execution environment, so no source-program build or SVM execution is claimed here.

Use the upstream `lz:oft-adapter:solana:create` task with the existing mint, and configure pause/unpause roles, zero OFT fees and six shared decimals. Set paused before accepting inventory or enabling peers. Verify source accounts using solana/verify-mint.mjs and inspect Adapter store/code/authorities. Enroll the evidence hash via SourceRegistry.enroll using registrar multisig. Deploy/create the destination launch, then wire peers/security/options.

`layerzero.config.ts` supplies chain points and requires explicit per-direction config JSON. Use the pinned upstream OApp wiring tools after review. `scripts/configure/evm.mjs` creates reviewable endpoint/ULN/options calldata; it does not broadcast. The EVM peer is already fixed; attempting to wire a different peer reverts. Gas, Solana account creation rent, lookup tables, DVN support and confirmations require path-specific simulation. Do not copy arbitrary defaults.

## End-to-end acceptance procedure

1. Deploy and verify source Adapter program/store, destination contracts and reviewed OpenFour preset/harness. Record code hashes and all role/config accounts.
2. Set source paused. Configure verified peer/DVN/ULN/executor in each direction. Simulate both message paths.
3. Build bootstrap with the pinned SDK: simulate unpause+quote, then simulate the **entire** unpause+send+pause transaction with all signers and lookup tables. Confirm actual mint, escrow, destination vault/adapter, source depositor and deposit ID match signed project settings.
4. Send exact inventory. Record source signature, packet GUID and normalized escrow increase; deliver packet and compare minted amount/vault balance. Verify public sends fail.
5. Collect current source observations. Sign/activate at the fixed opening price. If current valuation no longer matches, do not activate using stale data. v0.1 has no repricing/cancellation recovery; address this product limitation before accepting deposits at scale.
6. Buy and sell through OpenFour; record net actual WBNB, fees and remaining inventory. Reach sold-out threshold, test migration failure/retry, inspect actual pool reserves and LP recipient, and confirm surplus token beneficiary.
7. Verify destination publicMode, wait finality, unpause source. Test source→BNB and BNB burn→source release. Reconcile total supply, TVL and all in-flight amounts. Test pause/retry without double credit.

Steps 1–7 on real networks are **pending**, not passed. No funded wallets, actual mint address, Four.Meme test authorization or live DVN configuration were supplied. Scripts and interfaces are prepared; do not represent localhost messages as LayerZero testnet success.
