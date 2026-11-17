import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {comparePrivateOperatorWebhookUrls} from './v17-7h6-private-webhook-ui-url-compare.mjs';

const base='https://ngoctien20.app.n8n.cloud/webhook/tien404-zalo-bot-private-qa-fixture';
const c=(a=base,b=base)=>comparePrivateOperatorWebhookUrls({
 creatorSavedUrl:a,n8nPublishedPostUrl:b
});
const allDeny=o=>{
 assert.equal(o.hostedNoSendCanaryAuthorized,false);
 assert.equal(o.independentlyVerifiedBotOwner,false);
 assert.equal(o.realJwtRlsVerified,false);
 assert.equal(o.canonicalStoreVerified,false);
 assert.equal(o.webhookConfigurationChanged,false);
 assert.equal(o.providerReadbackVerified,false);
 assert.equal(o.tokenUsed,false);
 assert.equal(o.networkCalls,0);
 assert.equal(o.providerSends,0);
 assert.equal(o.commerceWrites,0);
 assert.ok(!JSON.stringify(o).includes('tien404-zalo-bot-private-qa-fixture'));
};
test('H6-01 exact Creator and n8n Published URL match LOCAL UI ONLY',()=>{
 const out=c();
 assert.equal(out.status,'LOCAL_UI_URLS_MATCH_SOURCE_ONLY');
 assert.equal(out.twoUserProvidedUrlsMatched,true);
 assert.equal(out.verifiedProductionWebhookWorkflowId,'yIJk8LvJoLF40Z62');
 allDeny(out);
});
test('H6-02 different webhooks on same n8n host never pass',()=>{
 const out=c(base,base+'-OTHER');
 assert.equal(out.status,'LOCAL_UI_WEBHOOK_PAIRING_NO_GO');
 assert.equal(out.reason,'WEBHOOK_URL_MISMATCH_STOP_NO_CHANGE');
 allDeny(out);
});
test('H6-03 /webhook-test/ is rejected as non-production endpoint',()=>{
 const out=c(base,base.replace('/webhook/','/webhook-test/'));
 assert.equal(out.reason,'INVALID_OR_TEST_ENDPOINT_REJECTED');allDeny(out);
});
test('H6-04 different host including n8n-cloud lookalike is rejected',()=>{
 for(const url of [
  'https://ngoctien20.app.n8n.cloud.evil.example/webhook/abcdefghi',
  'https://other.app.n8n.cloud/webhook/abcdefghi',
  'https://ngoctien20.app.n8n.cloud@evil.example/webhook/abcdefghi'
 ]){const out=c(url,base);assert.equal(out.reason,'INVALID_OR_TEST_ENDPOINT_REJECTED');allDeny(out);}
});
test('H6-05 unencrypted http or unexpected port rejected',()=>{
 for(const url of [base.replace('https:','http:'),base.replace('n8n.cloud','n8n.cloud:8443')]){
  const r=c(url,base);assert.equal(r.reason,'INVALID_OR_TEST_ENDPOINT_REJECTED');allDeny(r);
 }
});
test('H6-06 query strings, fragments and credentials rejected even if both match',()=>{
 for(const url of [base+'?secret=123',base+'#fragment',base.replace('https://','https://user:pass@')]){
  const r=c(url,url);assert.equal(r.reason,'INVALID_OR_TEST_ENDPOINT_REJECTED');allDeny(r);
 }
});
test('H6-07 percent encoding, path traversal, slash ambiguity rejected',()=>{
 for(const url of [
  base.replace('private','%70rivate'),
  base.replace('tien404-zalo','../tien404-zalo'),
  base.replace('/webhook/','/webhook//'),
  base+'/'
 ]){const r=c(url,base);assert.equal(r.reason,'INVALID_OR_TEST_ENDPOINT_REJECTED');allDeny(r);}
});
test('H6-08 no URL or sensitive URL digest is ever included in receipt',()=>{
 const r=c();const str=JSON.stringify(r);
 assert.equal(r.urlContentsDisclosed,false);
 assert.ok(!str.includes('ngoctien20.app.n8n.cloud'));
 assert.ok(!str.includes('/webhook/'));
 assert.equal('webhookUrlSha256' in r,false);
});
test('H6-09 blank/malformed URL fails closed',()=>{
 for(const x of ['',null,undefined,'abc','https://',42]){
  const r=comparePrivateOperatorWebhookUrls({creatorSavedUrl:x,n8nPublishedPostUrl:base});
  assert.equal(r.status,'LOCAL_UI_WEBHOOK_PAIRING_NO_GO');allDeny(r);
 }
});
test('H6-10 host capitalization accepted with exact path casing retained',()=>{
 const r=c(base,base.replace('ngoctien20.app.n8n.cloud','NGOCTIEN20.APP.N8N.CLOUD'));
 assert.equal(r.twoUserProvidedUrlsMatched,true);allDeny(r);
 assert.equal(c(base,base.replace('private','Private')).twoUserProvidedUrlsMatched,false);
});
test('H6-11 CI cannot invoke local UI comparison CLI even with fake URLs',()=>{
 const entry=fileURLToPath(new URL('../../scripts/v177h6-private-compare-webhook-ui.mjs',import.meta.url));
 const p=spawnSync(process.execPath,[entry],{encoding:'utf8',
  env:{...process.env,CI:'true',GITHUB_ACTIONS:'true',
   T404_H6_CREATOR_WEBHOOK_URL:base,T404_H6_N8N_WEBHOOK_URL:base,
   T404_H6_CONSENT:'COMPARE_PRIVATE_UI_ONLY'}});
 assert.notEqual(p.status,0);
 assert.match(p.stdout,/LOCAL_INTERACTIVE_UI_COMPARE_REQUIRED/);
 assert.ok(!p.stdout.includes(base));
 assert.ok(!p.stderr.includes(base));
});
test('H6-12 owner-supplied Bot ID cannot substitute for matching webhook',()=>{
 const r=comparePrivateOperatorWebhookUrls({creatorSavedUrl:base,
  n8nPublishedPostUrl:base+'-different',botId:'310713943124689543'});
 assert.equal(r.twoUserProvidedUrlsMatched,false);
 assert.equal(r.independentlyVerifiedBotOwner,false);
 allDeny(r);
});
