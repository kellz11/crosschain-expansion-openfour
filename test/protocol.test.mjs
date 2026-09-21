import test from "node:test";
import assert from "node:assert/strict";
import { ethers } from "ethers";
import { fixture, U, SD, abi, at, observationTypes } from "./helpers.mjs";
const rejects = async (p) =>
  assert.rejects(async () => {
    const r = await p;
    if (r?.wait) await r.wait();
  });
test("OpenFour public-interface reference: funding, trading, migration and standard OFT send", async (t) => {
  const f = await fixture();
  t.after(() => f.rpc.disconnect());
  const { token, vault, curve, migrate, bridge, endpoint, bc, core, user, quote, D, G, V, P, router } = f;
  await t.test(
    "initial mint suppressed; implementations locked; module tags and schemas match ABI",
    async () => {
      assert.equal(await token.totalSupply(), 0n);
      assert.equal(await vault.totalRaised(), 0n);
      const d = await curve.descriptor();
      assert.equal(d[0], ethers.id(d[1]).slice(0, 18));
      assert.equal(d[2], "0.1.0");
      const schema = await curve.moduleEncodeSchema();
      assert.equal(schema.kind, "curve");
      assert.deepEqual(
        schema.params.map((x) => x.name),
        ["p0", "virtualTokens"],
      );
      assert.equal(await curve.getInitParams(), f.params.curveParams);
      assert.equal((await migrate.moduleEncodeSchema()).params.length, 2);
      await rejects(token.mint(await user.getAddress(), U));
      await rejects(token.burn(await user.getAddress(), U));
      await rejects(vault.transferQuote(await user.getAddress(), 1));
      await rejects(bridge.setPeer(bc.sourceEid, ethers.id("attacker")));
      await rejects(f.trade(U));
      assert.equal(token.interface.hasFunction("withdraw"), false);
      assert.equal(token.interface.hasFunction("cancel"), false);
      assert.equal(await f.sources.approved(bc.sourceEid, bc.sourceMint, bc.sourcePeer), true);
      await rejects(
        f.sources
          .connect(user)
          .enroll(bc.sourceEid, ethers.id("other mint"), bc.sourcePeer, ethers.id("evidence")),
      );
      await rejects(
        f.sources.enroll(bc.sourceEid, bc.sourceMint, ethers.id("replacement"), ethers.id("evidence")),
      );
      await rejects(f.factory.create({ ...bc, sourceMint: ethers.id("unverified mint") }));
    },
  );
  await t.test("preset rejects insolvent split, foreign quote, foreign adapter and extra data", async () => {
    await f.validator.validate(1, f.params);
    for (const patch of [
      { saleAmount: D },
      { quoteAsset: token.target },
      { raiseAmount: 1n },
      { customDataParams: "0x01" },
      { migrateParams: abi.encode(["address", "address"], [router.target, f.lp]) },
    ])
      await rejects(f.validator.validate(1, { ...f.params, ...patch }));
    await rejects(f.validator.validate(2, f.params));
  });
  await t.test(
    "bootstrap rejects wrong domain/peer/depositor/recipient/cap and non-endpoint caller",
    async () => {
      await rejects(f.deliver(f.bootstrap, { srcEid: 1 }));
      await rejects(f.deliver(f.bootstrap, { sender: ethers.id("wrong") }));
      await rejects(f.deliver(f.packet(vault.target, D, ethers.concat([ethers.id("wrong"), bc.depositId]))));
      await rejects(
        f.deliver(f.packet(await user.getAddress(), D, ethers.concat([bc.depositor, bc.depositId]))),
      );
      await rejects(f.deliver(f.packet(vault.target, D + SD, ethers.concat([bc.depositor, bc.depositId]))));
      await rejects(
        bridge.lzReceive(
          { srcEid: bc.sourceEid, sender: bc.sourcePeer, nonce: 1 },
          ethers.id("fake"),
          f.bootstrap,
          ethers.ZeroAddress,
          "0x",
        ),
      );
      assert.equal(await token.totalSupply(), 0n);
    },
  );
  await t.test(
    "exact bootstrap credits committed inventory; duplicate packets and pre-migration public imports fail",
    async () => {
      const guid = ethers.id("bootstrap");
      await f.deliver(f.bootstrap, {}, guid);
      assert.equal(await token.totalSupply(), D);
      assert.equal(await token.balanceOf(vault.target), D);
      assert.equal(await bridge.funded(), true);
      await rejects(f.deliver(f.bootstrap, {}, guid));
      await rejects(f.deliver(f.bootstrap));
      await rejects(f.deliver(f.packet(await user.getAddress(), SD)));
      await rejects(f.trade(U));
    },
  );
  await t.test(
    "attestation rejects stale, future, low eligibility, wrong price/domain and signer",
    async () => {
      const now = Number((await f.provider.getBlock("latest")).timestamp);
      for (const patch of [
        { observedAt: now - 1000, expiresAt: now - 1 },
        { observedAt: now + 100 },
        { marketAge: 180 * 86400 },
        { marketCapUsd: 500000n * U },
        { tokenUsd: 1n },
        { identity: ethers.id("wrong") },
      ]) {
        const { o, signature } = await f.signObservation(patch);
        await rejects(token.activate(o, signature));
      }
      const { o } = await f.signObservation();
      const wrong = await ethers.Wallet.createRandom().signTypedData(
        { name: "ExpansionPrice", version: "1", chainId: 31337, verifyingContract: f.attestor.target },
        observationTypes,
        o,
      );
      await rejects(token.activate(o, wrong));
      await f.activate();
      assert.equal(await token.active(), true);
      await rejects(f.activate());
    },
  );
  await t.test(
    "buys and sells telescope; transfers retain sellability; reserve mismatch is rejected",
    async () => {
      const n = 1000n * U;
      await f.trade(n);
      assert.equal(await vault.totalRaised(), f.F(n));
      let context = {
        token: token.target,
        trader: await user.getAddress(),
        amount: U,
        isBuy: false,
        remainingForSale: G - n,
        totalRaised: f.F(n),
        timestamp: 0,
        proof: "0x",
      };
      assert.equal((await curve.evaluate({ ...context, amount: n + 1n })).executable, false);
      assert.equal((await curve.evaluate({ ...context, totalRaised: f.F(n) + 1n })).executable, false);
      const other = await f.provider.getSigner(3);
      await (await token.connect(user).transfer(await other.getAddress(), 100n * U)).wait();
      await (await token.connect(other).approve(core.target, ethers.MaxUint256)).wait();
      await f.trade(100n * U, false, other);
      await f.trade(900n * U, false);
      assert.equal(await vault.totalRaised(), 0n);
      assert.equal(await quote.balanceOf(vault.target), 0n);
      assert.equal(await vault.remainingForSale(), G);
      assert.equal(
        (await curve.evaluate({ ...context, remainingForSale: G, totalRaised: 0 })).executable,
        false,
      );
    },
  );
  await t.test("reverse quote maximality and seeded randomized solvency on deployed Solidity", async () => {
    let seed = 17n;
    let sold = 0n;
    for (let i = 0; i < 48; i++) {
      seed = (seed * 48271n) % 2147483647n;
      const buy = sold === 0n || seed % 3n !== 0n;
      const a = buy ? ((seed % 1000n) + 1n) * U : (seed % sold) + 1n;
      await f.trade(a, buy);
      sold += buy ? a : -a;
      assert.equal(await vault.totalRaised(), f.F(sold));
      assert.equal(await quote.balanceOf(vault.target), f.F(sold));
      assert.equal(await token.totalSupply(), D);
      const budget = f.F(sold + U) - f.F(sold);
      const [amount, q] = await curve.evaluateReverse(token.target, true, budget, G - sold, f.F(sold), 0);
      assert(q <= budget);
      assert(f.F(sold + amount + 1n) - f.F(sold) > budget || amount === G - sold);
    }
    await f.trade(sold, false);
    assert.equal(await vault.totalRaised(), 0n);
  });
  await t.test("pre-migration outbound, unauthorized migration and pause violations fail", async () => {
    const send = {
      dstEid: bc.sourceEid,
      to: bc.depositor,
      amountLD: U,
      minAmountLD: U,
      extraOptions: "0x",
      composeMsg: "0x",
      oftCmd: "0x",
    };
    await rejects(bridge.connect(user).send(send, { nativeFee: 0, lzTokenFee: 0 }, await user.getAddress()));
    await rejects(bridge.connect(user).setPaused(true));
    await (await bridge.setPaused(true)).wait();
    await rejects(f.deliver(f.packet(await user.getAddress(), SD)));
    await (await bridge.setPaused(false)).wait();
    await rejects(core.graduate(token.target));
  });
  await t.test(
    "sellout dust threshold handled; migration failure rolls back and retries exactly once",
    async () => {
      await f.trade(G - U / 2n);
      assert.equal(await vault.phase(), 5n);
      assert.equal(await migrate.ready(), true);
      const b = await vault.totalRaised(),
        bal = await token.balanceOf(vault.target);
      await (await router.setFail(true)).wait();
      await rejects(core.graduate(token.target, { gasLimit: 5000000 }));
      assert.equal(await vault.phase(), 5n);
      assert.equal(await migrate.executed(), false);
      assert.equal(await quote.balanceOf(vault.target), b);
      assert.equal(await token.balanceOf(vault.target), bal);
      assert.equal(await bridge.publicMode(), false);
      await (await router.setFail(false)).wait();
      await (await core.graduate(token.target, { gasLimit: 5000000 })).wait();
      assert.equal(await vault.phase(), 3n);
      assert.equal(await bridge.publicMode(), true);
      assert.equal(await quote.balanceOf(vault.target), 0n);
      assert.equal(await token.balanceOf(vault.target), 0n);
      const pool = await migrate.pool();
      assert.equal(await quote.balanceOf(pool), b);
      assert((await token.balanceOf(pool)) <= D - G + U / 2n);
      assert.equal(await at("MockPair", pool, f.signer).balanceOf(f.lp), 1000n);
      await rejects(core.graduate(token.target));
      await rejects(f.trade(U));
    },
  );
  await t.test(
    "post-graduation authenticated mint, standard OFT burn, dust retention, pause and replay",
    async () => {
      const guid = ethers.id("public");
      await f.deliver(f.packet(await user.getAddress(), 100n * SD), {}, guid);
      assert.equal(await token.totalSupply(), D + 100n * SD);
      await rejects(f.deliver(f.packet(await user.getAddress(), 100n * SD), {}, guid));
      const send = {
        dstEid: bc.sourceEid,
        to: bc.depositor,
        amountLD: 50n * SD + 123n,
        minAmountLD: 50n * SD,
        extraOptions: "0x",
        composeMsg: "0x",
        oftCmd: "0x",
      };
      const before = await token.balanceOf(await user.getAddress());
      await (
        await bridge
          .connect(user)
          .send(send, { nativeFee: 0, lzTokenFee: 0 }, await user.getAddress(), { gasLimit: 1000000 })
      ).wait();
      assert.equal(before - (await token.balanceOf(await user.getAddress())), 50n * SD);
      assert.equal(await token.totalSupply(), D + 50n * SD);
      const wire = await endpoint.lastMessage();
      assert.equal(BigInt("0x" + wire.slice(66, 82)), 50n);
      await (await bridge.setPaused(true)).wait();
      await rejects(f.deliver(f.packet(await user.getAddress(), SD)));
      await rejects(
        bridge.connect(user).send(send, { nativeFee: 0, lzTokenFee: 0 }, await user.getAddress()),
      );
    },
  );
});
