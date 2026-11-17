#!/usr/bin/env node
// TIEN404 V17.7H.6 — UI-only local comparison, NO NETWORK, NO TOKEN.
import {comparePrivateOperatorWebhookUrls} from
 '../qa/v17-7a-oa-independent/v17-7h6-private-webhook-ui-url-compare.mjs';
const print=o=>process.stdout.write(JSON.stringify(o)+'\n');
if(process.env.CI==='true'||process.env.GITHUB_ACTIONS==='true'||
   !process.stdin.isTTY||!process.stdout.isTTY||
   process.env.T404_H6_CONSENT!=='COMPARE_PRIVATE_UI_ONLY'){
 print({status:'LOCAL_INTERACTIVE_UI_COMPARE_REQUIRED',noNetworkCalls:true});
 process.exitCode=4;
}else{
 let creator=process.env.T404_H6_CREATOR_WEBHOOK_URL;
 let n8n=process.env.T404_H6_N8N_WEBHOOK_URL;
 delete process.env.T404_H6_CREATOR_WEBHOOK_URL;
 delete process.env.T404_H6_N8N_WEBHOOK_URL;
 delete process.env.T404_H6_CONSENT;
 try{
  const result=comparePrivateOperatorWebhookUrls({
   creatorSavedUrl:creator,n8nPublishedPostUrl:n8n
  });
  print(result);
  process.exitCode=result.twoUserProvidedUrlsMatched?0:5;
 }catch{
  print({status:'UI_LOCAL_COMPARE_FAILED_REDACTED',
   noNetworkCalls:true,hostedNoSendCanaryAuthorized:false});
  process.exitCode=5;
 }finally{creator=undefined;n8n=undefined;}
}
