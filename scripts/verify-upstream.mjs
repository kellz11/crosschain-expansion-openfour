import fs from "node:fs";
import crypto from "node:crypto";
const m = JSON.parse(fs.readFileSync("vendor/openfour/manifest.json"));
for (const [p, expected] of Object.entries(m.files)) {
  const actual = crypto
    .createHash("sha256")
    .update(fs.readFileSync(`vendor/openfour/${p}`))
    .digest("hex");
  if (actual !== expected) throw new Error(`Modified upstream source: ${p}`);
}
console.log(`Verified ${Object.keys(m.files).length} OpenFour source files at ${m.commit}`);
