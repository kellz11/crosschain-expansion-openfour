import fs from "node:fs";
import ganache from "ganache";
import { ethers } from "ethers";
export const U = 10n ** 18n,
  SD = 10n ** 12n;
export const abi = ethers.AbiCoder.defaultAbiCoder();
export const bridgeType =
  "tuple(uint32 sourceEid,bytes32 sourcePeer,bytes32 sourceMint,bytes32 depositor,bytes32 depositId,address beneficiary)";
export const observationTypes = {
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
export function artifact(name) {
  return JSON.parse(fs.readFileSync(`artifacts/${name}.json`));
}
export function at(name, address, signer) {
  return new ethers.Contract(address, artifact(name).abi, signer);
}
export async function deploy(name, signer, args = []) {
  const a = artifact(name);
  const c = await new ethers.ContractFactory(a.abi, a.evm.bytecode.object, signer).deploy(...args);
  await c.waitForDeployment();
  return c;
}
export async function fixture() {
  const rpc = ganache.provider({
    logging: { quiet: true },
    wallet: { deterministic: true },
    chain: { chainId: 31337, hardfork: "shanghai" },
    miner: { blockGasLimit: 30000000 },
  });
  const provider = new ethers.BrowserProvider(rpc);
  provider.pollingInterval = 10;
  const signer = await provider.getSigner(0),
    user = await provider.getSigner(1),
    beneficiary = await signer.getAddress(),
    lp = await (await provider.getSigner(2)).getAddress();
  const oracleWallet = ethers.Wallet.createRandom();
  const endpoint = await deploy("MockEndpoint", signer),
    quote = await deploy("MockQuote", signer),
    router = await deploy("MockV2Router", signer);
  const adapter = await deploy("PancakeV2ExpansionAdapter", signer, [router.target]);
  const attestor = await deploy("EligibilityPriceAttestor", signer, [
    oracleWallet.address,
    180 * 86400,
    500000n * U,
    600,
  ]);
  const sources = await deploy("SourceRegistry", signer, [beneficiary]);
  const factory = await deploy("ExpansionBridgeFactory", signer, [
    endpoint.target,
    beneficiary,
    sources.target,
  ]);
  const tokenImpl = await deploy("ExpansionToken", signer, [factory.target, attestor.target]);
  const tm = await deploy("ExpansionTokenModule", signer),
    vi = await deploy("StandardVault", signer),
    ci = await deploy("ExpansionCurveModule", signer),
    ti = await deploy("MockSimpleTradeModule", signer),
    mi = await deploy("ExpansionMigrateModule", signer);
  const validator = await deploy("ExpansionPresetValidator", signer, [1, quote.target, adapter.target, lp]);
  const core = await deploy("MockCore", signer, [quote.target]);
  const D = 1000000n * U,
    G = (D * 39n) / 100n,
    V = (D * 325n) / 100n,
    P = 10n ** 12n,
    B0 = (P * V) / U;
  const F = (x) => (B0 * x + V - x - 1n) / (V - x);
  const bc = {
    sourceEid: 40168,
    sourcePeer: ethers.id("fixture source store"),
    sourceMint: ethers.id("fixture source mint"),
    depositor: ethers.id("fixture Solana signer"),
    depositId: ethers.id("fixture unique deposit"),
    beneficiary,
  };
  await (
    await sources.enroll(bc.sourceEid, bc.sourceMint, bc.sourcePeer, ethers.id("fixture admission evidence"))
  ).wait();
  const params = {
    name: "Expansion Test",
    symbol: "XTEST",
    tokenUri: "",
    maxSupply: D,
    saleAmount: G,
    raiseAmount: F(G),
    quoteAsset: quote.target,
    tokenSalt: ethers.ZeroHash,
    tokenParams: abi.encode([bridgeType], [bc]),
    vaultParams: "0x",
    curveParams: abi.encode(["uint256", "uint256"], [P, V]),
    tradeParams: "0x",
    migrateParams: abi.encode(["address", "address"], [adapter.target, lp]),
    customDataParams: "0x",
  };
  const implementations = [tokenImpl.target, tm.target, vi.target, ci.target, ti.target, mi.target];
  const receipt = await (
    await core.create(implementations, validator.target, params, { gasLimit: 14000000 })
  ).wait();
  const e = receipt.logs
    .map((l) => {
      try {
        return core.interface.parseLog(l);
      } catch {
        return null;
      }
    })
    .find((e) => e?.name === "Created");
  const token = at("ExpansionToken", e.args.token, signer),
    vault = at("StandardVault", e.args.vault, signer),
    curve = at("ExpansionCurveModule", e.args.curve, signer),
    migrate = at("ExpansionMigrateModule", e.args.migrate, signer);
  const bridge = at("ExpansionOFTAdapter", await token.bridge(), signer);
  let nonce = 0;
  async function deliver(message, origin = {}, guid = ethers.id(`packet-${++nonce}`)) {
    return (
      await endpoint.deliver(
        bridge.target,
        { srcEid: bc.sourceEid, sender: bc.sourcePeer, nonce, ...origin },
        guid,
        message,
        { gasLimit: 3000000 },
      )
    ).wait();
  }
  function packet(to, amount, compose = "0x") {
    return ethers.solidityPacked(
      ["bytes32", "uint64", "bytes"],
      [ethers.zeroPadValue(to, 32), amount / SD, compose],
    );
  }
  const bootstrap = packet(vault.target, D, ethers.concat([bc.depositor, bc.depositId]));
  async function signObservation(overrides = {}) {
    const now = Number((await provider.getBlock("latest")).timestamp);
    const o = {
      token: token.target,
      identity: await token.identity(),
      tokenUsd: P * 600n,
      bnbUsd: 600n * U,
      marketCapUsd: 1000000n * U,
      marketAge: 181 * 86400,
      observedAt: now,
      expiresAt: now + 300,
      nonce: 1,
      ...overrides,
    };
    const signature = await oracleWallet.signTypedData(
      { name: "ExpansionPrice", version: "1", chainId: 31337, verifyingContract: attestor.target },
      observationTypes,
      o,
    );
    return { o, signature };
  }
  async function activate() {
    const { o, signature } = await signObservation();
    return (await token.activate(o, signature)).wait();
  }
  async function trade(amount, buy = true, who = user) {
    const r = await curve.evaluate({
      token: token.target,
      trader: await who.getAddress(),
      amount,
      isBuy: buy,
      remainingForSale: await vault.remainingForSale(),
      totalRaised: await vault.totalRaised(),
      timestamp: 0,
      proof: "0x",
    });
    return (
      await core
        .connect(who)
        .trade(token.target, amount, buy, buy ? r.quoteAmount : 0n, 2n ** 64n - 1n, { gasLimit: 3000000 })
    ).wait();
  }
  await (await quote.mint(await user.getAddress(), 100000n * U)).wait();
  await (await quote.connect(user).approve(core.target, ethers.MaxUint256)).wait();
  await (await token.connect(user).approve(core.target, ethers.MaxUint256)).wait();
  return {
    rpc,
    provider,
    signer,
    user,
    lp,
    oracleWallet,
    endpoint,
    quote,
    router,
    adapter,
    attestor,
    sources,
    factory,
    tokenImpl,
    validator,
    core,
    params,
    implementations,
    token,
    vault,
    curve,
    migrate,
    bridge,
    D,
    G,
    V,
    P,
    F,
    bc,
    deliver,
    packet,
    bootstrap,
    signObservation,
    activate,
    trade,
  };
}
