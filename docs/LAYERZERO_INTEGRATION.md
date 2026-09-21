# LayerZero integration

## Debit and credit model

Solana: stock OFT **Adapter**, locks/unlocks existing legacy SPL token; no mint-authority takeover. BNB: standard MintBurnOFTAdapter subclass credits/burns an OpenFourToken extension. LayerZero authenticates peer packets through selected message libraries/DVNs; it is neither a price oracle nor independent proof that a malicious source program actually holds collateral.

Six shared decimals; BNB local decimals 18; source decimals 6–18 allowed subject to actual uint64 supply bounds and conservative asset policy. Bootstrap amount is exact in shared units. Public sends remove dust by the standard OFT implementation; dust stays with the sender. EID 40168 is Solana devnet; 40102 is BSC testnet; EVM chain ID is 97. Mainnet is intentionally not configured.

## Exact bootstrap

1. Verify deployed Solana program bytes against pinned source build, upgrade authority, Adapter type, mint/store/escrow binding, TVL, actual escrow balance, token program, source authorities, six shared decimals, zero bridge fees, endpoint, peer, pause roles and ULN config. Enroll mint/store in SourceRegistry with evidence hash.
2. Create OpenFour market. Token starts at zero supply, its dedicated adapter fixes the approved source peer and its own vault/amount/depositor/deposit ID. Trading remains blocked by token.active.
3. Configure Solana peer to that EVM adapter and both directions' libraries/DVNs/executors/options. Source store stays paused. Do not create a second independent Adapter for this mint.
4. `quotePaused` builds **simulation only**: unpause then quote. The stock quote instruction checks pause. Simulation rolls back; a standalone real unpause to fetch a quote is forbidden by this operating procedure.
5. `buildBootstrap` constructs one transaction: authorized unpause → standard OFT send (exact amount, vault recipient, depositId compose payload) → authorized pause. All relevant role signers sign the same transaction. Transaction size/compute limits and lookup tables must be simulated before submission; never split the three instructions across transactions.
6. Standard Solana message encoding prefixes compose data with the authenticated source signer. Destination validates all 104 bytes: recipient(32), amountSD(8), depositor(32), depositId(32). It consumes this metadata locally, credits only the fixed vault, and marks funded. No public compose callback is scheduled for bootstrap.
7. Consume fresh source-price/eligibility attestation to activate. The curve cannot trade an unfunded/inactive market.

An operator can wrongly unpause early, but all additional credits are rejected while the market is active. Such users may lock source assets with undelivered packets. Destination safety is independent of the source operator following the pause procedure; source-side availability is not. This is why the UI and monitoring must block public sends and display actual source pause state.

## Graduation and normal transfer

Destination `publicMode` requires funded=true, tokenPhase=Migrated, and bound migrator.executed=true. No owner setter bypasses it. The source operator verifies finalized migration and LP evidence, then unpauses. This second transaction is a liveness dependency; no synchronous cross-chain state machine is claimed. Normal inbound messages must be the standard 40-byte non-compose packet; arbitrary compose is disabled. Public outbound sends must target the canonical source EID. Do not send public messages with compose metadata from Solana to this MVP.

## Configuration and recovery

Fixed EVM peers cannot be replaced. Adapter owner may pause and manage standard OFT options/inspector/configuration through the inherited OApp surface. Endpoint delegate may change verification libraries/DVNs; governance procedures must independently bound that authority. Source admin can change peer/config/fees and source program upgrade authority can replace code unless revoked. These are material supply trust assumptions, not hidden emergency mint mechanisms.

Messages execute once through endpoint payload clearing; the adapter additionally records GUIDs. A reverted delivery remains pending, without destination credit. Retry the same verified packet after correcting gas/config/pause; never mint manually or resend the deposit to recover it. A malformed bootstrap can remain permanently pending; no unsafe emergency collateral release is included. Successful burn followed by failed source delivery means pending withdrawal, not missing collateral. Source fee withdrawal is bounded by `escrow balance - tvl_ld` in the pinned implementation; direct donations are not TVL.

Production monitoring must aggregate supply and pending messages for the entire approved mesh, reconcile decimal units, alert on source actual balance < TVL, changed code/authorities/security settings, duplicate canonical representations, lingering messages, pause divergence and misconfigured fee rates. Endpoint metadata presence is not proof a selected DVN supports this particular route.
