import fs from "node:fs";
import crypto from "node:crypto";
const base = "developer/startup/vendor/openfour";
const m = JSON.parse(fs.readFileSync(`${base}/manifest.json`));
for (const [p, record] of Object.entries(m.files)) {
  const actual = crypto
    .createHash("sha256")
    .update(fs.readFileSync(`${base}/${p}`))
    .digest("hex");
  if (actual !== record.sha256) throw new Error(`Modified upstream source: ${p}`);
}
console.log(`Verified ${Object.keys(m.files).length} OpenFour source files at ${m.commit}`);
