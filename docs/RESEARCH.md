# Current OpenFour provenance

The active pin is `6f7efd5d3f14ed280cf471f70675ffba6d319943` (2026-11-02), Integration Guide 0.0.6. Current sources are under `developer/startup/vendor/openfour`; the manifest records each upstream source path and SHA-256. `node scripts/verify-upstream.mjs` checks integrity. Solc is now 0.8.24 via Hardhat, optimizer 200/viaIR. Current CreateTokenArgs includes partner, TradeResult contains revertData bytes, and StandardVault supports the current sell settlement functions. ExpansionTokenModule publishes its bootstrap schema through Tools.

The developer-owned fork reuses published Core/Registry/FeeRouter/CreateDeployer/Tools and standard module implementations without copying their closed source. See [integration](OPENFOUR_INTEGRATION.md) and [fork evidence](reports/openfour-fork.json). Module instances use Registry-managed beacons.

The original research below is retained as historical context; its old pins, compiler, missing-schema and untested-Core statements are superseded by the current integration and test report.

# Research snapshot and provenance

Retrieved September 19, 2026 US Eastern / September 20 UTC. GitHub archives were fetched by SHA; npm versions and integrity hashes are locked. Search results pointed at older guides, so the actual repository HEAD was inspected instead.

| Subject | Current retrieved source | Finding used in this design |
|---|---|---|
| OpenFour | [0527d529d59c6a3fbc9927ce391ecc97c66e1b01](https://github.com/four-meme-community/openfour-docs/tree/0527d529d59c6a3fbc9927ce391ecc97c66e1b01), commit date 2026-09-08 | Developer Guide 0.0.2; Integration Guide 0.0.4 |
| Developer lifecycle/modules | [Developer Guide](https://github.com/four-meme-community/openfour-docs/blob/0527d529d59c6a3fbc9927ce391ecc97c66e1b01/docs/developer-guide.md), sections 3–4, 10–13, 17 | Per-token clones; token-module initialization precedes other modules; migration pending/execute/hook/migrated order; official registration only |
| Token extension | [OpenFourToken.sol](https://github.com/four-meme-community/openfour-docs/blob/0527d529d59c6a3fbc9927ce391ecc97c66e1b01/contracts/token/OpenFourToken.sol) | Required inheritance; overridable initial mint; vault-only phase; migrator-only pool registration; OpenZeppelin 4 transfer hooks |
| Custody | [StandardVault.sol](https://github.com/four-meme-community/openfour-docs/blob/0527d529d59c6a3fbc9927ce391ecc97c66e1b01/contracts/modules/vault/StandardVault.sol) | Real quote accounting; Core-only transfers; migrator-only migration transfers; sold-out threshold is remaining <=1e18; `burnToken` sends to dead, not ERC20 `_burn` |
| Schemas/Preset | [OpenFourTypes.sol](https://github.com/four-meme-community/openfour-docs/blob/0527d529d59c6a3fbc9927ce391ecc97c66e1b01/contracts/libraries/OpenFourTypes.sol), [validator](https://github.com/four-meme-community/openfour-docs/blob/0527d529d59c6a3fbc9927ce391ecc97c66e1b01/contracts/interfaces/IOpenFourPresetValidator.sol) | Exact structs compiled locally; validators are view-only, so replay consumption belongs in activation |
| Existing migration boundary | [IPancakeV2MigrationAdapter.sol](https://github.com/four-meme-community/openfour-docs/blob/0527d529d59c6a3fbc9927ce391ecc97c66e1b01/contracts/interfaces/IPancakeV2MigrationAdapter.sol) | Published adapter ABI; actual bonding migrator implementation not public |
| Classic Four.Meme | [5f7f589b042e4e3b41c2c214d0fe3a81b36725a9](https://github.com/four-meme-community/fourmeme-docs/tree/5f7f589b042e4e3b41c2c214d0fe3a81b36725a9) | Classic TokenManager/TokenManager2/Helper lite interfaces, explicitly separate from OpenFour; no custom-module internals to borrow |
| Other community repository | four-meme-ai HEAD `c81f0eebbabec16998b2457f7e881e1b70b86420` | Integration skills/tooling; not production OpenFour source |
| LayerZero EVM | [devtools 4973ba8bef7b0fdf7268469abea3ea50dbd4bbd8](https://github.com/LayerZero-Labs/devtools/tree/4973ba8bef7b0fdf7268469abea3ea50dbd4bbd8/packages/oft-evm/contracts) | OFTCore, OFT, OFTAdapter, MintBurnOFTAdapter; source lock/destination mint chosen; destination burn/source unlock on return |
| LayerZero packages | oft-evm 4.0.1; oapp-evm 0.4.1; endpoint/message packages 3.0.168 | Actual npm source compiled. Mint/burn interface returns bool; explicit interface inheritance catches mismatch |
| Solana implementation | [oft program](https://github.com/LayerZero-Labs/devtools/tree/4973ba8bef7b0fdf7268469abea3ea50dbd4bbd8/examples/oft-solana/programs/oft) | Adapter `send.rs` increments TVL and transfers SPL; `lz_receive.rs` debits TVL and releases; `withdraw_fee.rs` limits withdrawals to balance minus TVL; `set_pause.rs` uses separate pause/unpause roles |
| Solana SDK | @layerzerolabs/oft-v2-solana-sdk 3.0.168 | `oft302` export, generated setPause, quote/send builders. Both send and quote_send reject paused stores |
| Deployment workflow | [official Solana example README](https://github.com/LayerZero-Labs/devtools/blob/4973ba8bef7b0fdf7268469abea3ea50dbd4bbd8/examples/oft-solana/README.md), [Solana overview](https://docs.layerzero.network/v2/developers/solana/oft/overview) | Deploy own OFT program; Adapter store for existing mint; wire both directions, verify upgrade/delegate authority and decimal consistency |
| Chain environment | [official metadata API](https://metadata.layerzero-api.com/v1/metadata), saved under deployments/reference | BSC testnet chain ID 97 / EID 40102; Solana devnet EID 40168. Endpoint listing does not establish a working DVN path |
| PancakeSwap | [V2 router documentation](https://developer.pancakeswap.finance/contracts/v2/router-v2) | ERC20 `addLiquidity`, desired/minimum amounts, recipient and deadline. WBNB stays ERC20 inside migration |

## Public evidence limits

No production Core, Registry, standard BondingCurveModule, SimpleTradeModule, BondingPcsV2/V4 source, test deployment permission, or verified bytecode was supplied. The public FairLaunch migrator has a compile-time reference to `ctx.soldOut` absent from MigrateHookContext. We do not fix or rebrand that sample as production code. The reused source closure compiles unchanged. No conclusion that standard bonding modules are mathematically incompatible can be drawn from their names alone.

The Solidity compiler is pinned to 0.8.30 as a deliberate stable reference target, not described as the latest compiler. OpenZeppelin 4.9.6 is required by the public OpenFourToken hook ABI and is supported by the pinned LayerZero peers. The newer npm package versions observed in registry queries are not substituted silently.
