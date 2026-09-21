import fs from "node:fs";
import assert from "node:assert/strict";
import { ethers } from "ethers";
// Generate reviewable calldata; no automatic broadcast or invented DVN addresses.
const c = JSON.parse(fs.readFileSync(process.argv[2]));
const endpoint = new ethers.Interface([
  "function setSendLibrary(address oapp,uint32 eid,address lib)",
  "function setReceiveLibrary(address oapp,uint32 eid,address lib,uint256 gracePeriod)",
  "function setConfig(address oapp,address lib,tuple(uint32 eid,uint32 configType,bytes config)[] params)",
]);
const bridge = new ethers.Interface([
  "function setEnforcedOptions(tuple(uint32 eid,uint16 msgType,bytes options)[] params)",
]);
assert(
  c.requiredDVNs?.length >= 1 && c.requiredDVNs.every(ethers.isAddress),
  "Choose reviewed DVNs supported in BOTH directions",
);
const dvns = [...c.requiredDVNs].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
assert(new Set(dvns.map((x) => x.toLowerCase())).size === dvns.length, "Duplicate DVNs");
assert(
  c.confirmations > 0 && c.executorGas > 0 && c.executor,
  "Explicit confirmations/gas/executor required",
);
const coder = ethers.AbiCoder.defaultAbiCoder();
const uln = coder.encode(
  [
    "tuple(uint64 confirmations,uint8 requiredDVNCount,uint8 optionalDVNCount,uint8 optionalDVNThreshold,address[] requiredDVNs,address[] optionalDVNs)",
  ],
  [[c.confirmations, dvns.length, 0, 0, dvns, []]],
);
const executor = coder.encode(["tuple(uint32 maxMessageSize,address executor)"], [[10000, c.executor]]);
// Type-3 options, executor worker=1, option-size=17, lzReceive option=1, uint128 gas.
const options = ethers.solidityPacked(
  ["uint16", "uint8", "uint16", "uint8", "uint128"],
  [3, 1, 17, 1, c.executorGas],
);
const txs = [
  {
    to: c.endpoint,
    data: endpoint.encodeFunctionData("setSendLibrary", [c.bridge, c.sourceEid, c.sendLibrary]),
  },
  {
    to: c.endpoint,
    data: endpoint.encodeFunctionData("setReceiveLibrary", [c.bridge, c.sourceEid, c.receiveLibrary, 0]),
  },
  {
    to: c.endpoint,
    data: endpoint.encodeFunctionData("setConfig", [
      c.bridge,
      c.sendLibrary,
      [
        [c.sourceEid, 2, uln],
        [c.sourceEid, 1, executor],
      ],
    ]),
  },
  {
    to: c.endpoint,
    data: endpoint.encodeFunctionData("setConfig", [c.bridge, c.receiveLibrary, [[c.sourceEid, 2, uln]]]),
  },
  {
    to: c.bridge,
    data: bridge.encodeFunctionData("setEnforcedOptions", [
      [
        [c.sourceEid, 1, options],
        [c.sourceEid, 2, options],
      ],
    ]),
  },
];
console.log(
  JSON.stringify(
    {
      requiredSender: "endpoint delegate / adapter owner multisig",
      warning: "EVM -> Solana executor gas/rent options need path-specific simulation before broadcast",
      transactions: txs,
    },
    null,
    2,
  ),
);
