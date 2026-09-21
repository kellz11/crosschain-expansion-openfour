import fs from "node:fs";
import crypto from "node:crypto";
const url = "https://metadata.layerzero-api.com/v1/metadata";
const response = await fetch(url);
if (!response.ok) throw new Error(`Metadata HTTP ${response.status}`);
const all = await response.json();
const selected = Object.fromEntries(
  ["bsc-testnet", "solana-testnet"].map((k) => [
    k,
    {
      chainDetails: all[k].chainDetails,
      deployments: all[k].deployments.filter((d) => d.version === 2),
      rpcs: all[k].rpcs,
      dvns: all[k].dvns,
    },
  ]),
);
const body = JSON.stringify(selected, null, 2);
fs.mkdirSync("deployments/reference", { recursive: true });
fs.writeFileSync(
  "deployments/reference/layerzero-testnets.json",
  JSON.stringify(
    {
      source: url,
      retrievedAt: new Date().toISOString(),
      sha256: crypto.createHash("sha256").update(body).digest("hex"),
      data: selected,
    },
    null,
    2,
  ),
);
console.log(
  "Updated official metadata snapshot. Review the diff; metadata presence is not a successful messaging test.",
);
