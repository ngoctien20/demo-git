import test from 'node:test';
import assert from 'node:assert/strict';
import { REQUIRED_GATES, reviewS2Evidence, classifyZaloEvidence } from './evidence-review.mjs';

const proof = g => ({status:'VERIFIED',evidenceRef:'https://example.invalid/evidence/'+g, verifiedAt:'2026-11-21T00:00:00Z',scope:'synthetic-only'});
const all = Object.fromEntries(REQUIRED_GATES.map(g=>[g,proof(g)]));
const locked = r => {
  assert.equal(r.evidenceOnly,true);
  for (const x of ['authenticatedOwner','verifiedProviderBot','qrIssuanceAllowed','rpcRevokeAllowed','hostedMigrationAllowed','providerSendAllowed','orderWriteAllowed','productionReady'])
    assert.equal(r[x],false,x);
};
test('Empty intake remains incomplete and locked',()=>{
 const r=reviewS2Evidence({}); assert.equal(r.classification,'EVIDENCE_INCOMPLETE');
 assert.equal(r.missing.length,REQUIRED_GATES.length); locked(r);
});
for(const g of REQUIRED_GATES)test('Missing '+g+' blocks review',()=>{
 const v={...all};delete v[g];
 const r=reviewS2Evidence(v);assert.deepEqual(r.missing,[g]);locked(r);
});
test('Even synthetic all-green evidence does not authorize operations',()=>{
 const r=reviewS2Evidence(all);
 assert.equal(r.classification,'HUMAN_REVIEW_REQUIRED'); assert.equal(r.missing.length,0);locked(r);
});
for(const [label,mutate] of [
 ['fake no evidenceRef', {status:'VERIFIED',verifiedAt:'2026-11-21T00:00:00Z',scope:'synthetic-only'}],
 ['fake weak evidenceRef', {status:'VERIFIED',evidenceRef:'x',verifiedAt:'2026-11-21T00:00:00Z',scope:'synthetic-only'}],
 ['fake bad date', {status:'VERIFIED',evidenceRef:'https://example.invalid/evidence',verifiedAt:'bad',scope:'synthetic-only'}],
 ['fake wrong status', {status:'PROPOSED',evidenceRef:'https://example.invalid/evidence',verifiedAt:'2026-11-21T00:00:00Z',scope:'synthetic-only'}],
 ['fake no scope', {status:'VERIFIED',evidenceRef:'https://example.invalid/evidence',verifiedAt:'2026-11-21T00:00:00Z'}],
 ['fake other type', 'VERIFIED']
])test(label+' cannot satisfy gate',()=>{
 const r=reviewS2Evidence({...all,real_auth_owner_a:mutate});
 assert.ok(r.missing.includes('real_auth_owner_a'));locked(r);
});
test('Arbitrary booleans, tokens, and role claims cannot turn on production',()=>{
 const r=reviewS2Evidence({...all,productionReady:true,allowSend:true,allowWrite:true,role:'owner',token:'synthetic'});
 locked(r);
});
test('Zalo OA Chatbot scenario share link is not Zalo Bot API URL',()=>{
 assert.equal(classifyZaloEvidence({product:'ZALO_OA_CHATBOT',kind:'SCENARIO_SHARE_LINK'}),'OFFICIAL_OA_ONLY_NOT_BOT_API');
});
test('Bot Creator Mini App QR is not customer Bot conversation QR',()=>{
 assert.equal(classifyZaloEvidence({product:'ZALO_BOT_CREATOR',kind:'CREATOR_MINIAPP_QR'}),'CREATOR_QR_NOT_CUSTOMER_BOT_CHAT');
});
test('Hypothetical Bot chat link still requires provider and device proof',()=>{
 assert.equal(classifyZaloEvidence({product:'ZALO_BOT_API',kind:'BOT_CHAT_LINK'}),'BOT_LINK_CANDIDATE_NEEDS_PROVIDER_AND_DEVICE_PROOF');
});
test('Fake link metadata stays unverified',()=>{
 assert.equal(classifyZaloEvidence({product:'ZALO_PERSONAL',kind:'QR_SHARE',url:'https://example.invalid'}),'UNVERIFIED');
});
test('Null input stays locked',()=>{
 const r=reviewS2Evidence(null);assert.equal(r.classification,'EVIDENCE_INCOMPLETE');locked(r);
});
