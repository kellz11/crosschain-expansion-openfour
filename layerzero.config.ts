// Review input for the pinned upstream oft-solana workspace, not a claim of wired deployments.
// Fill verified deployment addresses and per-direction ULN/executor configuration before wiring.
const required = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};
export default {
  contracts: [
    { contract: { eid: 40102, address: required('BNB_OFT_ADAPTER') } },
    { contract: { eid: 40168, address: required('SOLANA_OFT_STORE') } },
  ],
  connections: [
    { from: {eid:40102,address:required('BNB_OFT_ADAPTER')}, to:{eid:40168,address:required('SOLANA_OFT_STORE')}, config: JSON.parse(required('EVM_TO_SOLANA_LZ_CONFIG_JSON')) },
    { from: {eid:40168,address:required('SOLANA_OFT_STORE')}, to:{eid:40102,address:required('BNB_OFT_ADAPTER')}, config: JSON.parse(required('SOLANA_TO_EVM_LZ_CONFIG_JSON')) },
  ],
};
