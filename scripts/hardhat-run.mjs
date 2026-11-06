import "./hardhat-env.mjs";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const result = spawnSync(
  process.execPath,
  [
    require.resolve("hardhat/internal/cli/cli"),
    ...process.argv.slice(2),
    "--config",
    "developer/startup/hardhat.config.cjs",
  ],
  { stdio: "inherit", env: process.env },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
