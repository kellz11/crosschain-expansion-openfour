import test from "node:test";
import assert from "node:assert/strict";
import { ethers } from "ethers";
import { fixture, SD } from "./helpers.mjs";

test("normalized cross-chain supply with explicitly modeled source escrow and in-flight packets", async (t) => {
  const f = await fixture();
  t.after(() => f.rpc.disconnect());
  // MODEL ONLY: real Solana Adapter debit/credit is a separate SVM/testnet acceptance gate.
  let locked = 0n,
    inbound = 0n,
    outbound = 0n;
  const released = new Set();
  const check = async () => assert.equal((await f.token.totalSupply()) / SD + inbound + outbound, locked);
  const deposit = (amount) => {
    assert(amount > 0n);
    locked += amount;
    inbound += amount;
  };
  const release = (id, amount) => {
    assert(!released.has(id), "duplicate release");
    assert(amount <= outbound && amount <= locked, "backing mismatch");
    released.add(id);
    outbound -= amount;
    locked -= amount;
  };
  deposit(f.D / SD);
  await check();
  await f.deliver(f.bootstrap);
  inbound -= f.D / SD;
  await check();
  await f.activate();
  await f.trade(f.G);
  await (await f.core.graduate(f.token.target, { gasLimit: 5000000 })).wait();
  for (let i = 1n; i <= 12n; i++) {
    const amount = i * 100n;
    deposit(amount);
    await check();
    await f.deliver(f.packet(await f.user.getAddress(), amount * SD));
    inbound -= amount;
    await check();
    const burn = amount / 2n;
    await (
      await f.bridge.connect(f.user).send(
        {
          dstEid: f.bc.sourceEid,
          to: f.bc.depositor,
          amountLD: burn * SD + 1n,
          minAmountLD: burn * SD,
          extraOptions: "0x",
          composeMsg: "0x",
          oftCmd: "0x",
        },
        { nativeFee: 0, lzTokenFee: 0 },
        await f.user.getAddress(),
        { gasLimit: 1000000 },
      )
    ).wait();
    outbound += burn;
    await check();
    release(String(i), burn);
    await check();
    assert.throws(() => release(String(i), burn));
  }
  assert.throws(() => release("unbacked", locked + 1n));
  assert.equal(inbound, 0n);
  assert.equal(outbound, 0n);
});
