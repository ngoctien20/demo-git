#!/usr/bin/env node
/** V17.7H.4U - PRIVATE LOCAL interactive Bot ID discovery.
 * One Zalo Bot official getMe read-only method. No webhook changes.
 * MUST NOT execute in CI, public browser, n8n, shared cloud or ChatGPT.
 */
import {discoverExistingBotIdReadOnly,explicitDiscoveryConsent} from
 '../qa/v17-7a-oa-independent/v17-7h4u-private-bot-id-discovery.mjs';
import {createPinnedZaloHttpsReadOnlyTransport} from
 '../qa/v17-7a-oa-independent/v17-7h4-private-pinned-https-transport.mjs';
const print=x=>process.stdout.write(JSON.stringify(x)+'\n');
const deny=why=>({status:'PRIVATE_OPERATOR_BLOCKED',reason:why,
 canSend:false,canSetWebhook:false,canReadOrders:false,canGrantStore:false});
if(process.env.CI==='true'||process.env.GITHUB_ACTIONS==='true'||
   !process.stdin.isTTY||!process.stdout.isTTY||
   process.env.T404_H4U_OPERATOR_CONSENT!==explicitDiscoveryConsent){
 print(deny('INTERACTIVE_LOCAL_GETME_CONSENT_REQUIRED'));
 process.exitCode=4;
}else{
 let token=process.env.T404_H4U_BOT_TOKEN;
 delete process.env.T404_H4U_BOT_TOKEN;
 delete process.env.T404_H4U_OPERATOR_CONSENT;
 if(typeof token!=='string'||!token){
  print(deny('EPHEMERAL_PRIVATE_TOKEN_NOT_AVAILABLE'));process.exitCode=4;
 }else{
  try{
   const broker={
    kind:'LOCAL_EPHEMERAL_OPERATOR_SECRET',
    async withSecret(fn){return fn(token)}
   };
   const out=await discoverExistingBotIdReadOnly({
    approval:explicitDiscoveryConsent,
    secretBroker:broker,
    transport:createPinnedZaloHttpsReadOnlyTransport()
   });
   token=undefined;
   // Bot ID/account_name printed ONLY on the operator's private terminal.
   // Never print provider URL, token, request, raw JSON, customer details.
   print({
    status:out.status,
    reason:out.reason,
    methodCallsAttempted:out.methodCallsAttempted,
    localBotId:out.localBotId??null,
    localAccountName:out.localAccountName??null,
    originalWebhookUnchanged:out.originalWebhookUnchanged??null,
    canSend:false,canSetWebhook:false,canReadOrders:false,
    canGrantStore:false,ownerVerified:false,
    guidance:'PRIVATE_LOCAL_ONLY_DO_NOT_PASTE_BOT_ID_OR_TRANSCRIPT_IN_CHAT'
   });
   if(out.status!=='PRIVATE_GETME_BOT_ID_DISCOVERED_NOT_OWNER_VERIFIED')
     process.exitCode=5;
  }catch{
   token=undefined;
   print(deny('PRIVATE_GETME_ERROR_REDACTED'));process.exitCode=5;
  }
 }
}
