import { ethers } from "ethers";
export const INIT_PARAMS_TYPE =
  "tuple(string name,string symbol,string tokenUri,uint256 maxSupply,uint256 saleAmount,uint256 raiseAmount,address quoteAsset,bytes32 tokenSalt,bytes tokenParams,bytes vaultParams,bytes curveParams,bytes tradeParams,bytes migrateParams,bytes customDataParams)";
export const CREATE_ARGS_TYPE = `tuple(uint256 requestId,uint256 presetId,uint256 validTimestamp,uint256 createFee,uint256 presaleQuote,bool antiSniperEnabled,address partner,${INIT_PARAMS_TYPE} initParams)`;
export function encodeModuleParams(schema, values) {
  const params = schema.params ?? schema[2];
  if (params.length === 0) return "0x";
  return ethers.AbiCoder.defaultAbiCoder().encode(
    params.map((x) => x.abiType ?? x[1]),
    params.map((x) => {
      const name = x.name ?? x[0];
      if (values[name] === undefined) throw Error(`Missing ${name}`);
      return values[name];
    }),
  );
}
export function encodeCreate(args) {
  if (args.presaleQuote !== 0n || args.antiSniperEnabled !== false)
    throw Error("Expansion requires no presale and no anti-sniper");
  return ethers.AbiCoder.defaultAbiCoder().encode([CREATE_ARGS_TYPE], [args]);
}
export async function signCreate(signer, chainId, caller, createArgs) {
  if (![97n, 31337n].includes(BigInt(chainId)))
    throw Error("Development writes require BSC testnet or a local fork");
  const payload = ethers.solidityPacked(
    ["string", "uint256", "address", "bytes32"],
    ["createOpenFourToken", chainId, caller, ethers.keccak256(createArgs)],
  );
  return signer.signMessage(ethers.getBytes(ethers.keccak256(payload)));
}
