import "../hardhat-env.mjs";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { ethers } from "ethers";
import http from "node:http";
const require = createRequire(import.meta.url);
const upstream = process.env.BSC_TESTNET_RPC_URL ?? "https://bsc-testnet.publicnode.com";
const rpc = new ethers.JsonRpcProvider(upstream);
if ((await rpc.getNetwork()).chainId !== 97n) throw Error("Fork input must be BSC testnet (97)");
const block = process.env.BSC_FORK_BLOCK ?? String(await rpc.getBlockNumber());
const port = Number(process.env.LOCAL_FORK_PORT ?? 18545);
const local = `http://127.0.0.1:${port}`;
const dir = path.resolve("work/fork");
fs.mkdirSync(dir, { recursive: true });
const log = fs.openSync(path.join(dir, "node.log"), "w");
// Node handles upstream TLS; the EVM engine reads through a loopback, read-only RPC proxy.
const proxy = http.createServer(async (req, res) => {
  try {
    const parts = [];
    for await (const p of req) parts.push(p);
    const body = Buffer.concat(parts).toString();
    const parsed = JSON.parse(body);
    const calls = Array.isArray(parsed) ? parsed : [parsed];
    if (
      calls.some(
        (x) => !/^eth_(get|call|chainId|blockNumber)|^net_version$|^web3_clientVersion$/.test(x.method),
      )
    )
      throw Error("Read-only upstream RPC");
    const response = await fetch(upstream, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: AbortSignal.timeout(30000),
    });
    res.writeHead(response.status, { "Content-Type": "application/json" });
    res.end(await response.text());
  } catch (e) {
    res.writeHead(502);
    res.end(JSON.stringify({ error: String(e) }));
  }
});
await new Promise((resolve) => proxy.listen(0, "127.0.0.1", resolve));
const env = {
  ...process.env,
  BSC_FORK_RPC: `http://127.0.0.1:${proxy.address().port}`,
  BSC_FORK_BLOCK: block,
};
const node = spawn(
  process.execPath,
  [
    require.resolve("hardhat/internal/cli/cli"),
    "node",
    "--hostname",
    "127.0.0.1",
    "--port",
    String(port),
    "--config",
    "developer/startup/hardhat.config.cjs",
  ],
  { env, stdio: ["ignore", log, log], windowsHide: true },
);
const provider = new ethers.JsonRpcProvider(local, 31337, { staticNetwork: true });
async function run(file, extra = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [file], {
      env: { ...env, ...extra },
      stdio: "inherit",
      windowsHide: true,
    });
    p.on("error", reject);
    p.on("exit", (code) => (code === 0 ? resolve() : reject(Error(`${file} exited ${code}`))));
  });
}
try {
  let ready = false;
  for (let i = 0; i < 40; i++) {
    if (node.exitCode !== null) throw Error(`Hardhat node failed; see ${dir}/node.log`);
    try {
      const r = await fetch(local, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
        signal: AbortSignal.timeout(1000),
      });
      if ((await r.json()).result === "0x7a69") {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!ready) throw Error("Local fork not ready");
  await provider.send("evm_mine", []);
  const wallet = ethers.Wallet.createRandom();
  await provider.send("hardhat_setBalance", [wallet.address, ethers.toBeHex(ethers.parseEther("10000"))]);
  const testEnv = {
    RPC_URL: local,
    DEPLOYER_PRIVATE_KEY: wallet.privateKey,
    DRY_RUN: "0",
    SIGNER_ADDRESS: wallet.address,
  };
  console.log(`BSC testnet fork block ${block}; all writes confined to ${local}`);
  await run("developer/fork-deploy/fork-from-chain.js", testEnv);
  fs.writeFileSync(
    path.join(dir, "context.json"),
    JSON.stringify({ sourceChainId: 97, forkBlock: Number(block), chainId: 31337, rpcUrl: local }, null, 2),
  );
  await run("developer/startup/scripts/verify-fork.cjs", testEnv);
} finally {
  provider.destroy();
  rpc.destroy();
  node.kill();
  proxy.closeAllConnections();
  proxy.close();
  fs.closeSync(log);
}
