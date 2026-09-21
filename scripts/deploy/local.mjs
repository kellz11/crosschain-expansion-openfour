import fs from "node:fs";
import { fixture } from "../../test/helpers.mjs";
const f = await fixture();
try {
  await f.deliver(f.bootstrap);
  await f.activate();
  await f.trade(f.G);
  await (await f.core.graduate(f.token.target, { gasLimit: 5000000 })).wait();
  const output = {
    environment: "ephemeral Ganache; addresses disappear when this command exits",
    mockCore: f.core.target,
    token: f.token.target,
    bridge: f.bridge.target,
    pool: await f.migrate.pool(),
    publicMode: await f.bridge.publicMode(),
  };
  fs.mkdirSync("deployments", { recursive: true });
  fs.writeFileSync("deployments/local.json", JSON.stringify(output, null, 2));
  console.log(output);
} finally {
  await f.rpc.disconnect();
}
