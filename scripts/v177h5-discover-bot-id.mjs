#!/usr/bin/env node
// TIEN404 V17.7H.5 - manual Windows console ONLY. Cannot run in CI.
import {discoverBotIdWithGetMeOnly} from '../qa/v17-7a-oa-independent/v17-7h5-private-getme-discovery.mjs';
import {createPinnedZaloHttpsReadOnlyTransport} from '../qa/v17-7a-oa-independent/v17-7h4-private-pinned-https-transport.mjs';

const summary=x=>process.stdout.write(JSON.stringify(x)+'\n');
const blocked=reason=>({status:'DISCOVERY_NOT_STARTED',reason,
  canSend:false,canChangeWebhook:false,hostedCanaryApproved:false});
if(process.env.CI==='true'||process.env.GITHUB_ACTIONS==='true'||
   !process.stdin.isTTY||!process.stdout.isTTY||
   process.env.T404_H5_CONSENT!=='OWNER_CONSENT_GETME_DISCOVERY_ONLY'){
 summary(blocked('LOCAL_INTERACTIVE_READONLY_APPROVAL_REQUIRED'));
 process.exitCode=4;
}else{
 let token=process.env.T404_H5_BOT_TOKEN;
 delete process.env.T404_H5_BOT_TOKEN;
 delete process.env.T404_H5_CONSENT;
 if(typeof token!=='string'||token.length<20){
  summary(blocked('PRIVATE_LOCAL_TOKEN_MISSING'));process.exitCode=4;
 }else{
  try{
   const result=await discoverBotIdWithGetMeOnly({
    consent:'OWNER_CONSENT_GETME_DISCOVERY_ONLY',
    secretBroker:{
     kind:'LOCAL_EPHEMERAL_OPERATOR_SECRET',
     async withSecret(fn){return fn(token);}
    },
    transport:createPinnedZaloHttpsReadOnlyTransport()
   });
   token=undefined;
   summary(result);
   process.exitCode=result.status==='UNPINNED_BOT_ID_DISCOVERED_LOCAL_ONLY'?0:5;
  }catch{
   token=undefined;
   summary(blocked('PRIVATE_GETME_READBACK_FAILED_REDACTED'));process.exitCode=5;
  }
 }
}
