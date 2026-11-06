// End-to-end integration using live OpenFour/Pancake implementations on a LOCAL BNB testnet fork.
// Only LayerZero delivery and source admission are fixtures; no live bridge claim is made.
const fs = require("node:fs");
const assert = require("node:assert/strict");
const { ethers } = require("ethers");
const U = 10n ** 18n,
  SD = 10n ** 12n;
async function main() {
  const { encodeCreate, encodeModuleParams, signCreate } = await import(
    "../../../scripts/openfour/encoding.mjs"
  );
  const url = new URL(process.env.RPC_URL);
  assert(["127.0.0.1", "localhost"].includes(url.hostname), "Local fork only");
  const provider = new ethers.JsonRpcProvider(url.href, 31337, { staticNetwork: true });
  provider.pollingInterval = 50;
  assert.equal(BigInt(await provider.send("eth_chainId", [])), 31337n);
  const raw = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider),
    signer = new ethers.NonceManager(raw);
  const who = raw.address,
    oracle = ethers.Wallet.createRandom();
  const fork = JSON.parse(fs.readFileSync("developer/fork-deploy/out/fork-deployment.json"));
  const context = JSON.parse(fs.readFileSync("work/fork/context.json"));
  const checks = [],
    transactions = [];
  function check(label, condition) {
    assert(condition, label);
    checks.push(label);
    console.log("PASS", label);
  }
  function artifact(name) {
    return JSON.parse(fs.readFileSync(`artifacts/${name}.json`));
  }
  function at(name, address) {
    return new ethers.Contract(address, artifact(name).abi, signer);
  }
  async function sent(label, promise) {
    const tx = await promise,
      rc = await tx.wait();
    assert.equal(rc.status, 1);
    transactions.push({ label, hash: tx.hash });
    return rc;
  }
  async function deploy(name, args = []) {
    const a = artifact(name),
      c = await new ethers.ContractFactory(a.abi, a.evm.bytecode.object, signer).deploy(...args);
    await sent(`deploy ${name}`, Promise.resolve(c.deploymentTransaction()));
    return c;
  }
  const presetType =
    "tuple(uint256 id,string name,string description,string version,bool active,bool createEnabled,address validator,bytes32 tokenModuleId,bytes32 vaultModuleId,bytes32 curveModuleId,bytes32 tradeModuleId,bytes32 migrateModuleId,bytes32 tokenImplId,bytes32 customDataId,address author)";
  const registry = new ethers.Contract(
    fork.addresses.registry,
    [
      ...artifact("IOpenFourRegistry").abi,
      "function owner() view returns(address)",
      "function upsertTokenImpl(bytes32,address,string)",
      "function upsertModule(bytes32,address,uint8,tuple(bytes32 moduleId,string version,string name,string description,address author,uint16 feeShareBps),bool)",
      `function upsertPreset(${presetType})`,
    ],
    signer,
  );
  const core = new ethers.Contract(
    fork.addresses.core,
    [
      ...artifact("IOpenFourCore").abi,
      "function signer() view returns(address)",
      "function migrate(address token)",
    ],
    signer,
  );
  check(
    "Developer owns the fork Registry and Core signer",
    (await registry.owner()) === who && (await core.signer()) === who,
  );
  check(
    "Registry differs from the public hub",
    registry.target.toLowerCase() !== fork.source.registry.toLowerCase(),
  );
  const quote = new ethers.Contract(
    await core.wrappedNative(),
    [
      "function deposit() payable",
      "function approve(address,uint256) returns(bool)",
      "function transfer(address,uint256) returns(bool)",
      "function balanceOf(address) view returns(uint256)",
    ],
    signer,
  );
  const endpoint = await deploy("MockEndpoint");
  const sources = await deploy("SourceRegistry", [who]);
  const factory = await deploy("ExpansionBridgeFactory", [endpoint.target, who, sources.target]);
  const attestor = await deploy("EligibilityPriceAttestor", [oracle.address, 180 * 86400, 500000n * U, 600]);
  const tokenImpl = await deploy("ExpansionToken", [factory.target, attestor.target]);
  const tm = await deploy("ExpansionTokenModule"),
    ci = await deploy("ExpansionCurveModule"),
    mi = await deploy("ExpansionMigrateModule");
  const routerAddress = "0xD99D1c33F9fC3444f8101754aBC46c52416550D1";
  check("Pancake testnet router code exists", (await provider.getCode(routerAddress)) !== "0x");
  const adapter = await deploy("PancakeV2ExpansionAdapter", [routerAddress]);
  const lp = "0x000000000000000000000000000000000000dEaD",
    presetId = 2026110502n;
  const validator = await deploy("ExpansionPresetValidator", [presetId, quote.target, adapter.target, lp]);
  const tokenId = ethers.id("token.bnb_expansion_v2");
  await sent("register token implementation", registry.upsertTokenImpl(tokenId, tokenImpl.target, "0.2.0"));
  const ids = {};
  for (const [slot, kind, impl] of [
    ["token", 0, tm],
    ["curve", 2, ci],
    ["migrate", 4, mi],
  ]) {
    const tag = `module.${slot}.bnb_expansion_v2`,
      id = ethers.id(tag);
    ids[slot] = id;
    await sent(
      `register ${slot}`,
      registry.upsertModule(id, impl.target, kind, [id, "0.2.0", tag, "BNB backed expansion", who, 0], true),
    );
  }
  await sent(
    "register preset",
    registry.upsertPreset([
      presetId,
      "BNB backed expansion",
      "Solana-backed inventory on BNB OpenFour",
      "0.2.0",
      true,
      true,
      validator.target,
      ids.token,
      fork.moduleIds.VAULT_BASIC,
      ids.curve,
      fork.moduleIds.TRADE_SIMPLE,
      ids.migrate,
      tokenId,
      ethers.ZeroHash,
      who,
    ]),
  );
  const param =
    "tuple(string name,string abiType,uint8 decimals,bool optional,string title,string defaultValue,string hint,string minValue,string maxValue)";
  const schema = `tuple(string kind,uint8 version,${param}[] params)`;
  const estimate =
    "tuple(uint256 curveQuote,uint256 totalFee,uint256 userPays,uint256 userReceives,uint256 tokenAmount,uint256 executionPrice)";
  const tools = new ethers.Contract(
    fork.addresses.tools,
    [
      `function getPresetEncodeSchemas(uint256) view returns(${schema},${schema},${schema},${schema},${schema},${schema})`,
      `function estimateBuy(address,address,uint256,uint256,bytes) view returns(${estimate})`,
      `function estimateSell(address,address,uint256,uint256,bytes) view returns(${estimate})`,
    ],
    signer,
  );
  const schemas = await tools.getPresetEncodeSchemas(presetId);
  check(
    "Tools exposes six bootstrap fields and two curve/migration fields",
    schemas[0].params.length === 6 && schemas[2].params.length === 2 && schemas[4].params.length === 2,
  );
  const D = 1000000n * U,
    G = (D * 39n) / 100n,
    V = (D * 325n) / 100n,
    P = 10n ** 12n,
    B0 = (P * V) / U;
  const F = (x) => (B0 * x + V - x - 1n) / (V - x);
  const bc = {
    sourceEid: 40168,
    sourcePeer: ethers.id("FORK FIXTURE source store"),
    sourceMint: ethers.id("FORK FIXTURE source mint"),
    depositor: ethers.id("FORK FIXTURE depositor"),
    depositId: ethers.id("FORK FIXTURE unique deposit"),
    beneficiary: who,
  };
  await sent(
    "fixture source admission",
    sources.enroll(
      bc.sourceEid,
      bc.sourceMint,
      bc.sourcePeer,
      ethers.id("MOCK delivery; no source custody verified"),
    ),
  );
  const args = {
    requestId: 1n,
    presetId,
    validTimestamp: BigInt((await provider.getBlock("latest")).timestamp + 3600),
    createFee: 0n,
    presaleQuote: 0n,
    antiSniperEnabled: false,
    partner: ethers.ZeroAddress,
    initParams: {
      name: "BNB Expansion Fork Test",
      symbol: "BXT",
      tokenUri: "",
      maxSupply: D,
      saleAmount: G,
      raiseAmount: F(G),
      quoteAsset: quote.target,
      tokenSalt: ethers.ZeroHash,
      tokenParams: encodeModuleParams(schemas[0], bc),
      vaultParams: "0x",
      curveParams: encodeModuleParams(schemas[2], { p0: P, virtualTokens: V }),
      tradeParams: "0x",
      migrateParams: encodeModuleParams(schemas[4], { adapter: adapter.target, lpRecipient: lp }),
      customDataParams: "0x",
    },
  };
  const encoded = encodeCreate(args),
    signature = await signCreate(raw, 31337, who, encoded);
  const predicted = await core.createToken.staticCall(encoded, signature);
  const routerView = new ethers.Contract(
    routerAddress,
    ["function factory() view returns(address)"],
    provider,
  );
  const pcsFactory = new ethers.Contract(
    await routerView.factory(),
    [
      "function createPair(address,address) returns(address)",
      "function getPair(address,address) view returns(address)",
    ],
    signer,
  );
  await sent("pre-create empty Pancake pair", pcsFactory.createPair(predicted, quote.target));
  const precreated = await pcsFactory.getPair(predicted, quote.target);
  const rc = await sent("create token", core.createToken(encoded, signature, { gasLimit: 14000000 }));
  const event = rc.logs
    .map((l) => {
      try {
        return core.interface.parseLog(l);
      } catch {
        return null;
      }
    })
    .find((e) => e?.name === "TokenCreated");
  assert(event, "TokenCreated event");
  const token = at("ExpansionToken", event.args.token),
    vault = at("StandardVault", event.args.vault),
    curve = at("ExpansionCurveModule", event.args.curveModule),
    migrate = at("ExpansionMigrateModule", event.args.migrateModule),
    bridge = at("ExpansionOFTAdapter", await token.bridge());
  check(
    "Real Core accepts zero initial supply",
    (await token.totalSupply()) === 0n && (await token.balanceOf(vault.target)) === 0n,
  );
  check(
    "Real CreateDeployer initializes and binds custom modules",
    (await curve.boundToken()) === token.target &&
      (await migrate.boundToken()) === token.target &&
      (await migrate.feeRouter()) === fork.addresses.feeRouter,
  );
  const pool = await migrate.pool();
  check("Creation reuses an empty pre-created pair", pool === precreated);
  const pair = new ethers.Contract(
    pool,
    [
      "function token0() view returns(address)",
      "function getReserves() view returns(uint112,uint112,uint32)",
      "function totalSupply() view returns(uint256)",
      "function balanceOf(address) view returns(uint256)",
      "function sync()",
    ],
    signer,
  );
  check(
    "Pancake pool is registered before funding",
    (await token.migratedPools(pool)) && (await pair.totalSupply()) === 0n,
  );
  await assert.rejects(core.buy.staticCall(token.target, U, U, 0, "0x", { value: U }));
  checks.push("Unfunded trading rejected");
  const packet = ethers.solidityPacked(
    ["bytes32", "uint64", "bytes"],
    [ethers.zeroPadValue(vault.target, 32), D / SD, ethers.concat([bc.depositor, bc.depositId])],
  );
  await sent(
    "fixture bootstrap delivery",
    endpoint.deliver(bridge.target, [bc.sourceEid, bc.sourcePeer, 1], ethers.id("fork bootstrap"), packet),
  );
  check(
    "Exact committed inventory funds real vault",
    (await token.totalSupply()) === D && (await token.balanceOf(vault.target)) === D,
  );
  const now = Number((await provider.getBlock("latest")).timestamp);
  const observation = {
    token: token.target,
    identity: await token.identity(),
    tokenUsd: P * 600n,
    bnbUsd: 600n * U,
    marketCapUsd: 1000000n * U,
    marketAge: 181 * 86400,
    observedAt: now,
    expiresAt: now + 300,
    nonce: 1,
  };
  const types = {
    Observation: [
      ["token", "address"],
      ["identity", "bytes32"],
      ["tokenUsd", "uint256"],
      ["bnbUsd", "uint256"],
      ["marketCapUsd", "uint256"],
      ["marketAge", "uint256"],
      ["observedAt", "uint256"],
      ["expiresAt", "uint256"],
      ["nonce", "uint256"],
    ].map(([name, type]) => ({ name, type })),
  };
  const oracleSig = await oracle.signTypedData(
    { name: "ExpansionPrice", version: "1", chainId: 31337, verifyingContract: attestor.target },
    types,
    observation,
  );
  await sent("activate", token.activate(observation, oracleSig));
  async function buy(amount) {
    const q = await tools.estimateBuy(token.target, who, amount, 0, "0x");
    return sent(
      "Core buy",
      core.buy(token.target, amount, q.userPays, 0, "0x", { value: q.userPays, gasLimit: 10000000 }),
    );
  }
  await buy(100000n * U);
  check(
    "Real Core buy books only curve reserve",
    (await vault.totalRaised()) === F(100000n * U) &&
      (await quote.balanceOf(vault.target)) === F(100000n * U),
  );
  await assert.rejects(token.transfer.staticCall(pool, U));
  checks.push("Pre-graduation pool token deposit rejected");
  await sent("approve sell", token.approve(core.target, ethers.MaxUint256));
  const sell = await tools.estimateSell(token.target, who, 25000n * U, 1, "0x");
  await sent(
    "Core sell",
    core.sell(token.target, 25000n * U, sell.userReceives, 1, "0x", { gasLimit: 3000000 }),
  );
  check(
    "Real vault sell settlement preserves reserve invariant",
    (await vault.totalRaised()) === F(75000n * U) && (await quote.balanceOf(vault.target)) === F(75000n * U),
  );
  // A synced quote-only donation must not prevent graduation or divert the deposited inventory.
  const donation = 1000n;
  await sent("wrap donation", quote.deposit({ value: donation }));
  await sent("quote-only donation", quote.transfer(pool, donation));
  await sent("sync donation", pair.sync());
  const expectedTokens = await curve.liquidityTokens(G);
  await buy(G - 75000n * U);
  // Current Core can either auto-migrate at the terminal buy or leave an explicit migration step.
  if ((await vault.phase()) !== 3n)
    await sent("explicit Core migrate", core.migrate(token.target, { gasLimit: 8000000 }));
  check("Real Core completes migration once", (await vault.phase()) === 3n && (await migrate.executed()));
  check(
    "Real Pancake reserves equal migration plus donation",
    (await token.balanceOf(pool)) === expectedTokens && (await quote.balanceOf(pool)) === F(G) + donation,
  );
  check("LP minted to immutable recipient", (await pair.balanceOf(lp)) > 0n);
  check(
    "Vault inventory and accounted quote drained",
    (await token.balanceOf(vault.target)) === 0n && (await quote.balanceOf(vault.target)) === 0n,
  );
  const lpBeforeRepeat = await pair.totalSupply();
  const repeat = await sent("repeat Core migrate", core.migrate(token.target));
  check(
    "Repeated Core migrate performs no second migration",
    (await pair.totalSupply()) === lpBeforeRepeat &&
      (await token.balanceOf(pool)) === expectedTokens &&
      !repeat.logs.some((l) => {
        try {
          return core.interface.parseLog(l)?.name === "MigrateExecuted";
        } catch {
          return false;
        }
      }),
  );
  const router = new ethers.Contract(
    routerAddress,
    [
      "function swapExactETHForTokensSupportingFeeOnTransferTokens(uint256,address[],address,uint256) payable",
      "function swapExactTokensForETHSupportingFeeOnTransferTokens(uint256,uint256,address[],address,uint256)",
    ],
    signer,
  );
  const taxRecipient = await token.POOL_TAX_RECIPIENT(),
    taxBefore = await token.balanceOf(taxRecipient);
  await sent(
    "Pancake taxed buy",
    router.swapExactETHForTokensSupportingFeeOnTransferTokens(
      0,
      [quote.target, token.target],
      who,
      now + 3600,
      { value: U / 1000n, gasLimit: 1500000 },
    ),
  );
  check(
    "Real Pancake buy collects 0.15% pool transfer tax",
    (await token.balanceOf(taxRecipient)) > taxBefore,
  );
  await sent("approve Pancake sell", token.approve(router.target, U * 100n));
  const taxMid = await token.balanceOf(taxRecipient);
  await sent(
    "Pancake taxed sell",
    router.swapExactTokensForETHSupportingFeeOnTransferTokens(
      U * 100n,
      0,
      [token.target, quote.target],
      who,
      now + 3600,
      { gasLimit: 1500000 },
    ),
  );
  check(
    "Real Pancake sell collects exact 0.15% token tax",
    (await token.balanceOf(taxRecipient)) - taxMid === (U * 100n * 15n) / 10000n,
  );
  const report = {
    status: "PASS",
    generatedAt: new Date().toISOString(),
    ...context,
    openfourCommit: "6f7efd5d3f14ed280cf471f70675ffba6d319943",
    scope:
      "Real OpenFour and Pancake implementations; local BNB testnet fork; mocked LayerZero delivery and source admission",
    limitations: [
      "No live Solana escrow/BPF execution or LayerZero DVN delivery",
      "No public testnet/mainnet deployment or official Registry writes",
      "No independent security audit",
    ],
    implementations: fork.reusedImplementations,
    addresses: {
      ...fork.addresses,
      tokenImpl: tokenImpl.target,
      tokenModuleImpl: tm.target,
      curveImpl: ci.target,
      migrateImpl: mi.target,
      validator: validator.target,
      bridgeFactory: factory.target,
      attestor: attestor.target,
      sourceRegistry: sources.target,
      mockEndpoint: endpoint.target,
      token: token.target,
      vault: vault.target,
      curve: curve.target,
      migrate: migrate.target,
      pool,
      adapter: adapter.target,
    },
    checks,
    transactions,
  };
  fs.mkdirSync("docs/reports", { recursive: true });
  fs.writeFileSync("docs/reports/openfour-fork.json", JSON.stringify(report, null, 2));
  console.log(`Fork integration PASS: ${checks.length} checks`);
  provider.destroy();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
