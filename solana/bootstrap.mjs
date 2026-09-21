import assert from 'node:assert/strict';
import {transactionBuilder,publicKey} from '@metaplex-foundation/umi';
import {oft,OftPDA} from '@layerzerolabs/oft-v2-solana-sdk';
import {EndpointProgram,simulateWeb3JsTransaction} from '@layerzerolabs/lz-solana-sdk-v2/umi';
import {toWeb3JsInstruction,toWeb3JsPublicKey} from '@metaplex-foundation/umi-web3js-adapters';
import {ComputeBudgetProgram} from '@solana/web3.js';

export const LEGACY_TOKEN_PROGRAM='TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
export function normalize(amountLD,decimals){
 assert(Number.isInteger(decimals)&&decimals>=6&&decimals<=18,'unsupported decimals');
 const amount=BigInt(amountLD),rate=10n**BigInt(decimals-6);
 assert(amount>0n&&amount<=2n**64n-1n,'SPL amount bounds');
 assert(amount%rate===0n,'bootstrap cannot contain dust');
 return {amountSD:amount/rate,amountEVM:amount/rate*10n**12n};
}
export function verifyMint(m){
 assert.equal(m.owner,LEGACY_TOKEN_PROGRAM,'Token-2022 and unknown token programs rejected');
 assert.equal(m.mintAuthority,null,'MVP requires immutable supply');
 assert.equal(m.freezeAuthority,null,'MVP rejects freeze authority');
 assert(m.initialized===true,'mint not initialized');
 assert(Number.isInteger(m.decimals)&&m.decimals>=6&&m.decimals<=18,'unsupported decimals');
 assert(BigInt(m.supply)>0n&&BigInt(m.supply)<=2n**64n-1n,'SPL supply bounds');
 // Total source supply may contain shared-decimal dust; only the selected bootstrap must normalize exactly.
}
export function atomicBootstrap({programId,store,unpauser,pauser,sendInstruction}){
 const context={programs:oft.createOFTProgramRepo(publicKey(programId))};
 return transactionBuilder()
  .add(oft.instructions.setPause(context,{signer:unpauser,oftStore:publicKey(store),paused:false}))
  .add(sendInstruction)
  .add(oft.instructions.setPause(context,{signer:pauser,oftStore:publicKey(store),paused:true}));
}
// quote_send itself rejects a paused store. Unpause only in a simulated transaction;
// all simulated state is rolled back. Do not send a standalone unpause to get a quote.
export async function quotePaused({umi,programId,store,mint,escrow,unpauser,payer,sendParams,quoteRemainingAccounts,addressLookupTables=[]}){
 assert(quoteRemainingAccounts.length>0,'resolve quote CPI accounts from the configured endpoint/message library');
 const repo=oft.createOFTProgramRepo(publicKey(programId));
 const [derivedStore]=new OftPDA(publicKey(programId)).oftStore(publicKey(escrow));
 assert.equal(derivedStore,store,'wrong store PDA');
 const [peer]=new OftPDA(publicKey(programId)).peer(publicKey(store),sendParams.dstEid);
 const unpause=oft.instructions.setPause({programs:repo},{signer:unpauser,oftStore:publicKey(store),paused:false});
 const quote=oft.instructions.quoteSend({programs:repo},{oftStore:publicKey(store),peer,tokenMint:publicKey(mint),...sendParams,payInLzToken:false})
   .addRemainingAccounts(quoteRemainingAccounts);
 return simulateWeb3JsTransaction(umi.rpc,[ComputeBudgetProgram.setComputeUnitLimit({units:1000000}),...unpause.getInstructions().map(toWeb3JsInstruction),...quote.getInstructions().map(toWeb3JsInstruction)],toWeb3JsPublicKey(publicKey(programId)),toWeb3JsPublicKey(payer.publicKey),EndpointProgram.types.getMessagingFeeSerializer(),'confirmed',undefined,addressLookupTables.map(x=>toWeb3JsPublicKey(publicKey(x))));
}
// Caller supplies configured UMI + signer objects. No keys are generated or embedded.
export async function buildBootstrap({umi,programId,store,mint,escrow,tokenSource,depositor,unpauser,pauser,dstEid,vaultBytes32,depositId,amountLD,decimals,nativeFee,options}){
 normalize(amountLD,decimals);
 assert(vaultBytes32.length===32 && depositId.length===32,'bytes32 metadata');
 const info=await oft.accounts.fetchOFTStore(umi,publicKey(store));
 assert(info.paused,'bootstrap must start paused');
 assert.equal(info.oftType,oft.types.OFTType.Adapter,'source must be lock/unlock Adapter');
 assert.equal(info.ld2sdRate,10n**BigInt(decimals-6),'shared decimals mismatch');
 assert.equal(info.defaultFeeBps,0,'bootstrap requires zero OFT fee');
 assert.equal(info.pauser.__option,'Some');assert.equal(info.pauser.value,pauser.publicKey);
 assert.equal(info.unpauser.__option,'Some');assert.equal(info.unpauser.value,unpauser.publicKey);
 assert.equal(info.tokenMint,mint);assert.equal(info.tokenEscrow,escrow);
 const ix=await oft.send(umi.rpc,{payer:depositor,tokenMint:publicKey(mint),tokenEscrow:publicKey(escrow),tokenSource:publicKey(tokenSource)},
 {dstEid,to:vaultBytes32,amountLd:BigInt(amountLD),minAmountLd:BigInt(amountLD),nativeFee:BigInt(nativeFee),options,composeMsg:depositId},
 {oft:publicKey(programId),token:publicKey(LEGACY_TOKEN_PROGRAM)});
 return atomicBootstrap({programId,store,unpauser,pauser,sendInstruction:ix});
}
