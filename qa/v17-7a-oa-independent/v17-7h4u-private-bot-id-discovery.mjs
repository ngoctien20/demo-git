/**
 * TIEN404 V17.7H.4U — discover the EXISTING Zalo Bot numeric ID
 * without requiring that ID to be visible in Bot Creator first.
 *
 * Private local operator, ONE official getMe read-only API call maximum.
 * Reuses the exact pinned HTTPS transport of PR #381. Never changes
 * webhook, owner/binding, token, customer data or Commerce access.
 *
 * A provider token proves only access to that credential, NOT independent
 * Bot Creator human ownership or canonical Store authority.
 */
import {createHash} from 'node:crypto';

const NUMERIC_BOT_ID=/^[0-9]{8,24}$/;
const SHA=x=>createHash('sha256').update(x,'utf8').digest('hex');
const CONSENT='OWNER_CONSENT_GETME_ONLY_LOCAL';
const blocked=(reason,count=0)=>Object.freeze({
 status:'PRIVATE_BOT_DISCOVERY_NO_GO',reason,methodCallsAttempted:count,
 botCreatorOwnerVerified:false,realStoreBindingVerified:false,
 providerSessionIndependentlyVerified:false,
 canSend:false,canSetWebhook:false,canDeleteWebhook:false,
 canGetUpdates:false,canReadOrders:false,canGrantStore:false,
 canPromoteCore:false,canDeploy:false
});
export async function discoverExistingBotIdReadOnly(input={}){
 const {approval,secretBroker,transport,now=()=>Date.now()}=input||{};
 if(approval!==CONSENT||!secretBroker||
    secretBroker.kind!=='LOCAL_EPHEMERAL_OPERATOR_SECRET'||
    typeof secretBroker.withSecret!=='function'||
    !transport||transport.kind!=='PINNED_ZALO_HTTPS_POST_READONLY'||
    typeof transport.postReadOnly!=='function')
  return blocked('PRIVATE_CONSENT_OR_PINNED_TRANSPORT_MISSING');
 let count=0,profile;
 try{
  await secretBroker.withSecret(async token=>{
   if(typeof token!=='string'||token.length<20||token.length>512||
      !/^[A-Za-z0-9._:-]+$/.test(token))
     throw Error('INVALID_TOKEN_SHAPE');
   count=1;
   // Exactly ONE read-only method. NO getWebhookInfo until separately
   // consented and a retrieved ID can be pinned in PR #381's existing CLI.
   profile=await transport.postReadOnly('getMe',token);
  });
 }catch{
  return blocked('PRIVATE_GETME_FAILED_REDACTED',count);
 }
 if(count!==1||!profile||typeof profile!=='object'||Array.isArray(profile)||
   profile.ok!==true||!profile.result||
   typeof profile.result!=='object'||Array.isArray(profile.result)||
   typeof profile.result.id!=='string'||
   !NUMERIC_BOT_ID.test(profile.result.id)||
   typeof profile.result.account_name!=='string'||
   profile.result.account_name.length<3||
   profile.result.account_name.length>100)
  return blocked('PROVIDER_BOT_PROFILE_INVALID_REDACTED',count);
 const observed=now();
 if(!Number.isSafeInteger(observed)||observed<=0)
  return blocked('LOCAL_CLOCK_INVALID',count);
 return Object.freeze({
  ...blocked('TOKEN_AUTHENTICATED_GETME_ONLY_NO_OWNER_PROOF',count),
  status:'PRIVATE_GETME_BOT_ID_DISCOVERED_NOT_OWNER_VERIFIED',
  // PRIVATE DEVICE ONLY. NEVER paste this numeric ID or local transcript in chat.
  localBotId:profile.result.id,
  localAccountName:profile.result.account_name,
  botIdSha256:SHA(profile.result.id),
  observedAtMs:observed,
  readyForSeparatePinnedWebhookReadback:true,
  originalWebhookUnchanged:true
 });
}
export const explicitDiscoveryConsent=CONSENT;
