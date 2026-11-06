import fs from "node:fs";
import path from "node:path";
// Keep Hardhat's process-local configuration and cache inside the checkout on Windows.
if (process.platform === "win32") {
  const runtime = path.resolve("work/hardhat-runtime");
  fs.mkdirSync(runtime, { recursive: true });
  process.env.APPDATA = runtime;
  process.env.LOCALAPPDATA = runtime;
}
process.env.HARDHAT_DISABLE_TELEMETRY_PROMPT = "true";
