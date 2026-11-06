import "./hardhat-env.mjs";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
process.env.HARDHAT_CONFIG = path.resolve("developer/startup/hardhat.config.cjs");
const hre = require("hardhat");
await hre.run("compile");
fs.mkdirSync("artifacts", { recursive: true });
const sizes = {},
  units = new Set();
for (const name of await hre.artifacts.getAllFullyQualifiedNames()) {
  const a = await hre.artifacts.readArtifact(name);
  units.add(a.sourceName);
  const bytecode = a.bytecode.slice(2),
    runtime = a.deployedBytecode.slice(2);
  fs.writeFileSync(
    `artifacts/${a.contractName}.json`,
    JSON.stringify(
      {
        source: a.sourceName,
        contractName: a.contractName,
        abi: a.abi,
        evm: { bytecode: { object: bytecode }, deployedBytecode: { object: runtime } },
      },
      null,
      2,
    ),
  );
  if (a.sourceName.startsWith("contracts/") && bytecode) {
    sizes[a.contractName] = runtime.length / 2;
    if (sizes[a.contractName] > 24576) throw Error(`${a.contractName} exceeds EIP-170`);
  }
}
const report = {
  compiler: require("solc").version(),
  build: "Hardhat",
  sourceUnits: units.size,
  settings: { optimizer: { enabled: true, runs: 200 }, viaIR: true, evmVersion: "shanghai" },
  sizes,
};
fs.writeFileSync("artifacts/build-report.json", JSON.stringify(report, null, 2));
console.log(report);
