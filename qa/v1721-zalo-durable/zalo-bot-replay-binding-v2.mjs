/**
 * TIEN404 V17.21 — signed server-owned installation -> versioned DO claim RPC.
 * SOURCE ONLY: never route unverified webhook JSON into this adapter.
 * Upstream V17.20 admitBotEvent checks Bot header auth, private event shape,
 * provider timestamp and computes HMAC event key + payload digest.
 *
 * This file does NOT create a public endpoint or connect any production
 * credential. Real Workers require owner-approved service bindings and UAT.
 */
import {createHash} from 'node:crypto';
const ID=/^[A-Za-z0-9_.:-]{3,128}$/;
const HEX=/^[0-9a-f]{64}$/;
export function bindZaloReplayClaimV2({namespace,installationRef}){
 if(!namespace||typeof namespace.getByName!=='function'||
    typeof installationRef!=='string'||!ID.test(installationRef))
   throw Error('TRUSTED_REPLAY_DO_BINDING_REQUIRED');
 const scope=createHash('sha256').update('TIEN404/ZALO_BOT/V2/'+installationRef).digest('hex');
 const stub=namespace.getByName('ZALO-BOT-V2:'+scope);
 if(!stub||typeof stub.claimHashedEvent!=='function')throw Error('REPLAY_DO_RPC_MISSING');
 return async ({key,digest,expiresAtMs})=>{
   if(typeof key!=='string'||!HEX.test(key)||typeof digest!=='string'||!HEX.test(digest)||
      !Number.isSafeInteger(expiresAtMs))
     throw Error('REPLAY_INPUT_NOT_HASHED');
   const verdict=await stub.claimHashedEvent({key,digest,expiresAtMs});
   if(!['CLAIMED','DUPLICATE','CONFLICT'].includes(verdict))
     throw Error('REPLAY_DO_INVALID_RESULT');
   return verdict;
 };
}
