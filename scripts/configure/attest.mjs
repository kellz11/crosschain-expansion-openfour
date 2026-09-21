import fs from "node:fs";
import assert from "node:assert/strict";
import { ethers } from "ethers";
const [observationFile, verifier, chainId] = process.argv.slice(2);
assert(process.env.ATTESTATION_KEY, "Supply ephemeral signing key via environment; never commit it");
const observation = JSON.parse(fs.readFileSync(observationFile));
const types = {
  Observation: [
    ["token", "address"],
    ["identity", "bytes32"],
    ["tokenUsd", "uint256"],
    ["bnbUsd", "uint256"],
    ["marketCapUsd", "uint256"],
    ["marketAge", "uint256"],
    ["observedAt", "uint256"],
    ["expiresAt", "uint256"],
    ["nonce", "uint256"],
  ].map(([name, type]) => ({ name, type })),
};
const signature = await new ethers.Wallet(process.env.ATTESTATION_KEY).signTypedData(
  { name: "ExpansionPrice", version: "1", chainId: BigInt(chainId), verifyingContract: verifier },
  types,
  observation,
);
console.log(JSON.stringify({ observation, signature }, null, 2));
