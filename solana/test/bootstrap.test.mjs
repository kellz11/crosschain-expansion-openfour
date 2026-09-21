import test from 'node:test';
import assert from 'node:assert/strict';
import {createNoopSigner,publicKey} from '@metaplex-foundation/umi';
import {atomicBootstrap,normalize,verifyMint,LEGACY_TOKEN_PROGRAM} from '../bootstrap.mjs';
const key=publicKey('11111111111111111111111111111111');
test('actual pinned SDK builds one atomic unpause/send/pause builder',()=>{
 const signer=createNoopSigner(key);const send={instruction:{programId:key,keys:[],data:new Uint8Array([99])},signers:[],bytesCreatedOnChain:0};
 const tx=atomicBootstrap({programId:key,store:key,unpauser:signer,pauser:signer,sendInstruction:send});
 const ix=tx.getInstructions();assert.equal(ix.length,3);assert.equal(ix[0].data[8],0);assert.equal(ix[1].data[0],99);assert.equal(ix[2].data[8],1);
 assert.deepEqual(Array.from(ix[0].data.slice(0,8)),[63,32,154,2,56,103,79,45]);
});
test('source precision and asset rejection policy',()=>{
 assert.deepEqual(normalize(123000n,9),{amountSD:123n,amountEVM:123000000000000n});
 for(const [a,d] of [[123001n,9],[1n,5],[2n**64n,6]])assert.throws(()=>normalize(a,d));
 const mint={owner:LEGACY_TOKEN_PROGRAM,mintAuthority:null,freezeAuthority:null,initialized:true,supply:1000000000n,decimals:9};verifyMint(mint);
 verifyMint({...mint,supply:1000000001n});
 for(const patch of [{owner:'Token-2022'},{freezeAuthority:'someone'},{mintAuthority:'someone'},{initialized:false}])assert.throws(()=>verifyMint({...mint,...patch}));
});
