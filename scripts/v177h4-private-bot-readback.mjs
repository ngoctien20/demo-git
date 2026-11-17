#!/usr/bin/env node
/**
 * TIEN404 V17.7H.4 — OFF BY DEFAULT private local Zalo Bot readback.
 * Only launch via the explicitly consented PowerShell operator wrapper.
 * Real Bot API calls NEVER occur in CI, cloud workers, ChatGPT or Github.
 */
import {inspectPrivateTwoMethodBotReadback} from
 '../qa/v17-7a-oa-independent/v17-7h4-private-real-readback-gate.mjs';
import {createPinnedZaloHttpsReadOnlyTransport} from
 '../qa/v17-7a-oa-independent/v17-7h4-private-pinned-https-transport.mjs';

const safe=answer=>process.stdout.write(JSON.stringify(answer)+'\n');
const BLOCK=(reason)=>({status:'PRIVATE_OPERATOR_PREFLIGHT_BLOCKED',reason,
 canSend:false,canSetWebhook:false,canDeploy:false,hostedNoSendCanaryAuthorized:false});

if(process.env.CI==='true'||process.env.GITHUB_ACTIONS==='true'||
   !process.stdin.isTTY||!process.stdout.isTTY||
   process.env.T404_H4_OPERATOR_CONSENT!=='OWNER_CONSENT_TWO_READONLY_METHODS_ONLY'){
 safe(BLOCK('LOCAL_INTERACTIVE_EXPLICIT_CONSENT_REQUIRED'));
 process.exitCode=4;
}else{
 const botId=process.env.T404_H4_EXPECTED_BOT_ID;
 let token=process.env.T404_H4_BOT_TOKEN;
 delete process.env.T404_H4_BOT_TOKEN;
 delete process.env.T404_H4_OPERATOR_CONSENT;
 delete process.env.T404_H4_EXPECTED_BOT_ID;
 if(typeof token!=='string'||!token||!/^[0-9]{8,24}$/.test(botId||'')){
  safe(BLOCK('LOCAL_BOT_ID_OR_EPHEMERAL_SECRET_MISSING'));process.exitCode=4;
 }else{
  try{
   const broker=Object.freeze({
    kind:'LOCAL_EPHEMERAL_OPERATOR_SECRET',
    async withSecret(callback){return callback(token);}
   });
   const out=await inspectPrivateTwoMethodBotReadback({
    expectedBotId:botId,
    approval:'OWNER_CONSENT_TWO_READONLY_METHODS_ONLY',
    secretBroker:broker,
    transport:createPinnedZaloHttpsReadOnlyTransport()
   });
   token=undefined;
   safe({
    status:out.status,reason:out.reason,
    methodCallsAttempted:out.methodCallsAttempted,
    webhookConfigured:out.webhookConfigured??null,
    // Digest-only results MUST REMAIN PRIVATE; never publish as ownership proof.
    botIdSha256:out.botIdSha256??null,
    webhookUrlSha256:out.webhookUrlSha256??null,
    ownerVerified:false,realSameStoreVerified:false,
    canSend:false,canSetWebhook:false,canReadOrders:false,
    hostedNoSendCanaryAuthorized:false,
    guidance:'PRIVATE_LOCAL_RECEIPT_ONLY_NOT_META_ZALO_OWNER_ATTESTATION'
   });
   process.exitCode=out.status==='PRIVATE_TWO_READONLY_RESPONSES_MATCH_BOT_OWNER_UNVERIFIED'?0:5;
  }catch{
   token=undefined;
   safe(BLOCK('PRIVATE_READBACK_FAILED_REDACTED'));
   process.exitCode=5;
  }
 }
}
