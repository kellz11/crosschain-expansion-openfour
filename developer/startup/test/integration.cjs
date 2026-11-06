const { expect } = require("chai");
const { ethers } = require("hardhat");
describe("BNB OpenFour integration boundaries", function () {
  it("prevents repeated token-module creation from overwriting stored metadata", async function () {
    const [owner] = await ethers.getSigners();
    const impl = await (await ethers.getContractFactory("ExpansionTokenModule")).deploy();
    const harness = await (await ethers.getContractFactory("MockTokenModuleHarness")).deploy();
    await harness.cloneModule(impl.target);
    const module = await ethers.getContractAt("ExpansionTokenModule", await harness.lastModule());
    const params = [1, "First", "ONE", 100, 39, 1, owner.address, "", "0x1234", ethers.ZeroHash];
    const args = [
      owner.address,
      harness.target,
      owner.address,
      owner.address,
      owner.address,
      owner.address,
      ethers.ZeroAddress,
      params,
      "0.2.0",
      "0.2.0",
    ];
    await expect(impl.createToken(...args)).revertedWith("TokenModule: already created");
    await module.createToken(...args);
    const changed = [...args];
    changed[7] = [...params];
    changed[7][8] = "0xabcd";
    await expect(module.createToken(...changed)).revertedWith("TokenModule: already created");
    expect(await module.getInitParams()).eq("0x1234");
    expect((await module.descriptor())[2]).eq("0.2.0");
  });
  it("publishes a discoverable token schema with exact bootstrap ABI order", async function () {
    const module = await (await ethers.getContractFactory("ExpansionTokenModule")).deploy();
    const schema = await module.moduleEncodeSchema();
    expect(schema.kind).eq("token");
    expect(schema.params.map((p) => p.name)).deep.eq([
      "sourceEid",
      "sourcePeer",
      "sourceMint",
      "depositor",
      "depositId",
      "beneficiary",
    ]);
    const { encodeModuleParams } = await import("../../../scripts/openfour/encoding.mjs");
    const values = {
      sourceEid: 40168,
      sourcePeer: ethers.id("peer"),
      sourceMint: ethers.id("mint"),
      depositor: ethers.id("signer"),
      depositId: ethers.id("deposit"),
      beneficiary: (await ethers.getSigners())[0].address,
    };
    expect(encodeModuleParams(schema, values)).eq(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint32", "bytes32", "bytes32", "bytes32", "bytes32", "address"],
        Object.values(values),
      ),
    );
  });
  it("rejects non-Solana source IDs at source admission", async function () {
    const [owner] = await ethers.getSigners();
    const registry = await (await ethers.getContractFactory("SourceRegistry")).deploy(owner.address);
    await expect(registry.enroll(40161, ethers.id("mint"), ethers.id("peer"), ethers.id("proof"))).reverted;
    await expect(registry.enroll(40168, ethers.id("mint"), ethers.id("peer"), ethers.id("proof"))).not
      .reverted;
  });
  it("locks module implementation initializers", async function () {
    const [owner] = await ethers.getSigners();
    for (const name of ["ExpansionCurveModule", "ExpansionMigrateModule"]) {
      const m = await (await ethers.getContractFactory(name)).deploy();
      const middle =
        name === "ExpansionCurveModule"
          ? [0, "", "", 0, 0, 0, owner.address, "", "0x", ethers.ZeroHash]
          : owner.address;
      await expect(m.init(owner.address, owner.address, middle, "0x", "0.2.0")).revertedWith(
        "Initializable: contract is already initialized",
      );
    }
  });
  it("rejects deployment on an unrelated EVM chain", async function () {
    const ganache = require("ganache");
    const rpc = ganache.provider({
      logging: { quiet: true },
      chain: { chainId: 1 },
      wallet: { deterministic: true },
    });
    try {
      const provider = new ethers.BrowserProvider(rpc),
        signer = await provider.getSigner();
      const a = await require("hardhat").artifacts.readArtifact("SourceRegistry");
      await require("node:assert/strict").rejects(
        new ethers.ContractFactory(a.abi, a.bytecode, signer).deploy(await signer.getAddress()),
      );
    } finally {
      await rpc.disconnect();
    }
  });
  it("binds create signatures to caller, chain and current partner-bearing tuple", async function () {
    const { encodeCreate, signCreate, CREATE_ARGS_TYPE } = await import(
      "../../../scripts/openfour/encoding.mjs"
    );
    const [owner, other] = await ethers.getSigners();
    const args = {
      requestId: 7n,
      presetId: 1n,
      validTimestamp: 2000000000n,
      createFee: 0n,
      presaleQuote: 0n,
      antiSniperEnabled: false,
      partner: other.address,
      initParams: {
        name: "Test",
        symbol: "T",
        tokenUri: "",
        maxSupply: 1n,
        saleAmount: 1n,
        raiseAmount: 1n,
        quoteAsset: owner.address,
        tokenSalt: ethers.ZeroHash,
        tokenParams: "0x",
        vaultParams: "0x",
        curveParams: "0x",
        tradeParams: "0x",
        migrateParams: "0x",
        customDataParams: "0x",
      },
    };
    const encoded = encodeCreate(args);
    expect(ethers.AbiCoder.defaultAbiCoder().decode([CREATE_ARGS_TYPE], encoded)[0].partner).eq(
      other.address,
    );
    const sig = await signCreate(owner, 31337, owner.address, encoded);
    const digest = (chain, caller) =>
      ethers.getBytes(
        ethers.keccak256(
          ethers.solidityPacked(
            ["string", "uint256", "address", "bytes32"],
            ["createOpenFourToken", chain, caller, ethers.keccak256(encoded)],
          ),
        ),
      );
    expect(ethers.verifyMessage(digest(31337, owner.address), sig)).eq(owner.address);
    expect(ethers.verifyMessage(digest(97, owner.address), sig)).not.eq(owner.address);
    expect(ethers.verifyMessage(digest(31337, other.address), sig)).not.eq(owner.address);
    expect(() => encodeCreate({ ...args, presaleQuote: 1n })).to.throw("no presale");
    expect(() => encodeCreate({ ...args, antiSniperEnabled: true })).to.throw("no anti-sniper");
    await require("node:assert/strict").rejects(signCreate(owner, 56, owner.address, encoded));
  });
});
