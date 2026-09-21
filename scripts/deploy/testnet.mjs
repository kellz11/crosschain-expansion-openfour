import fs from "node:fs";
import assert from "node:assert/strict";
import { ethers } from "ethers";
const required = (k) => {
  assert(process.env[k], `Missing ${k}`);
  return process.env[k];
};
const provider = new ethers.JsonRpcProvider(required("BSC_TESTNET_RPC_URL"));
assert.equal((await provider.getNetwork()).chainId, 97n, "This script deploys BSC TESTNET ONLY");
const signer = await provider.getSigner(required("DEPLOYER_ADDRESS")); // external unlocked test signer; no embedded key
const c = JSON.parse(fs.readFileSync(process.argv[2] ?? "deployments/example/testnet.json"));
for (const key of [
  "endpoint",
  "quoteAsset",
  "pcsRouter",
  "delegate",
  "registrar",
  "attestationSigner",
  "lpRecipient",
])
  assert(ethers.isAddress(c[key]) && c[key] !== ethers.ZeroAddress, `Configure ${key}`);
const endpoint = new ethers.Contract(c.endpoint, ["function eid() view returns(uint32)"], provider);
assert.equal(await endpoint.eid(), 40102n, "wrong endpoint");
for (const key of ["endpoint", "quoteAsset", "pcsRouter"])
  assert((await provider.getCode(c[key])) !== "0x", `No code: ${key}`);
const result = {
  environment: "bsc-testnet",
  chainId: 97,
  createdAt: new Date().toISOString(),
  configuration: c,
  contracts: {},
};
fs.mkdirSync("deployments", { recursive: true });
async function deploy(name, args = []) {
  const a = JSON.parse(fs.readFileSync(`artifacts/${name}.json`));
  const x = await new ethers.ContractFactory(a.abi, a.evm.bytecode.object, signer).deploy(...args);
  await x.waitForDeployment();
  result.contracts[name] = { address: x.target, tx: x.deploymentTransaction().hash };
  fs.writeFileSync("deployments/bsc-testnet.json", JSON.stringify(result, null, 2));
  return x;
}
const sources = await deploy("SourceRegistry", [c.registrar]);
const factory = await deploy("ExpansionBridgeFactory", [c.endpoint, c.delegate, sources.target]);
const oracle = await deploy("EligibilityPriceAttestor", [
  c.attestationSigner,
  180 * 86400,
  500000n * 10n ** 18n,
  600,
]);
await deploy("ExpansionToken", [factory.target, oracle.target]);
const adapter = await deploy("PancakeV2ExpansionAdapter", [c.pcsRouter]);
await deploy("ExpansionCurveModule");
await deploy("ExpansionMigrateModule");
await deploy("ExpansionPresetValidator", [c.presetId, c.quoteAsset, adapter.target, c.lpRecipient]);
console.log(
  "Deployment manifest written. Register with Four.Meme; this script does not deploy a substitute production Core.",
);
