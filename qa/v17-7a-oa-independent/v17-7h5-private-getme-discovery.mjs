/**
 * TIEN404 V17.7H.5 — FIRST-TIME BOT ID DISCOVERY VIA OFFICIAL getMe ONLY.
 * No pre-known Bot ID required; no webhook read/change/send.
 * Token stays in a private operator-only callback and never returned.
 * Successful getMe establishes token-to-Bot-ID lookup, NOT human/merchant owner.
 */
import {createHash} from 'node:crypto';
const SCOPED_CONSENT='OWNER_CONSENT_GETME_DISCOVERY_ONLY';
const BOT_ID=/^[0-9]{8,24}$/;
const BOT_HANDLE=/^bot\.[A-Za-z0-9._-]{5,80}$/i;
const TOKEN=/^[A-Za-z0-9._:-]{20,512}$/;
const denied=(reason,called=0)=>Object.freeze({
 status:'BOT_ID_DISCOVERY_NO_GO',reason,readMethodsAttempted:called,
 tokenPossessionOnly:false,independentHumanOwnerVerified:false,
 merchantStoreVerified:false,canVerifyWebhook:false,canChangeWebhook:false,
 canSend:false,canReadOrders:false,canWriteOrders:false,hostedCanaryApproved:false
});
export async function discoverBotIdWithGetMeOnly({consent,secretBroker,transport}={}){
 if(consent!==SCOPED_CONSENT||
    secretBroker?.kind!=='LOCAL_EPHEMERAL_OPERATOR_SECRET'||
    typeof secretBroker.withSecret!=='function'||
    transport?.kind!=='PINNED_ZALO_HTTPS_POST_READONLY'||
    typeof transport.postReadOnly!=='function')
  return denied('LOCAL_OPERATOR_CONSENT_OR_TRANSPORT_REQUIRED');
 let attempts=0,received;
 try{
  await secretBroker.withSecret(async secret=>{
   if(typeof secret!=='string'||!TOKEN.test(secret))
    throw Error('PRIVATE_TOKEN_INVALID');
   attempts++;
   received=await transport.postReadOnly('getMe',secret);
  });
 }catch{
  return denied('PRIVATE_GETME_FAILED_REDACTED',attempts);
 }
 const id=received?.result?.id,handle=received?.result?.account_name;
 if(received?.ok!==true||typeof id!=='string'||!BOT_ID.test(id)||
   typeof handle!=='string'||!BOT_HANDLE.test(handle))
  return denied('GETME_BOT_ID_OR_HANDLE_INVALID',attempts);
 const result=Object.freeze({
  status:'UNPINNED_BOT_ID_DISCOVERED_LOCAL_ONLY',
  // Local console visibility ONLY; this ID must still be independently
  // bound to the existing Bot Creator session and n8n integration.
  discoveredBotId:id,
  botIdSha256:createHash('sha256').update(id).digest('hex'),
  readMethodsAttempted:attempts,readMethod:'getMe',
  noWebhookInfoQueried:true,noBotConfigChanged:true,
  tokenPossessionOnly:true,independentHumanOwnerVerified:false,
  merchantStoreVerified:false,canVerifyWebhook:false,canChangeWebhook:false,
  canSend:false,canReadOrders:false,canWriteOrders:false,hostedCanaryApproved:false
 });
 return result;
}
export const discoveryConsentScope=SCOPED_CONSENT;
