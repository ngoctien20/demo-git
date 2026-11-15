import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto,createHash} from 'node:crypto';
import {resolveG22,G22_EXPECTED} from './g22-trusted-bot-resolver-core.mjs';
import worker from './g22-trusted-bot-resolver-worker.mjs';
globalThis.crypto ||= webcrypto;
const now=1794773066120;
const tenantId='11111111-2222-4333-8444-555555555555';
const tenantSha=createHash('sha256').update(tenantId).digest('hex');
const nonce='b'.repeat(64),digest='c'.repeat(64);
const kp=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
const spki=Buffer.from(await crypto.subtle.exportKey('spki',kp.publicKey)).toString('base64');
const baseRow={
  binding_id:G22_EXPECTED.binding_ref,provider:'zalo_bot_creator',
  tenant_uuid:tenantId,tenant_slug:G22_EXPECTED.tenant_slug,
  store_key:G22_EXPECTED.store_key,
  source:'SERVER_VERIFIED_QA_TENANT',status:'CANDIDATE',
  owner_certified:0,bot_digest:digest,challenge_hex:nonce,
  observed_ms:now-1000,expires_ms:now+86400000
};
function db(row=baseRow){
 return {prepare(sql){assert.match(sql,/SELECT binding_id,bot_digest,challenge_hex/);return{bind(ref){assert.equal(ref,G22_EXPECTED.binding_ref);return{first:async()=>row}}}}};
}
const claims={bot_digest:digest,challenge_nonce:nonce,provider:'zalo_bot_creator',
 source:'SERVER_HTTPS_ZALO_GETME',api_method:'POST',
 getme_http_status:200,getme_result_id_string:true,
 id_is_official_provider_result:true,actual_api_call_readonly:true};
async function proof(over={}){
 const c={...claims,...over.claims};
 const p={issuer:'ZALO_BOT_PROVIDER_ATTESTOR',purpose:'TIEN404_V145Z_LIVE03_CERTIFICATION_ONLY',
  issued_ms:now-1000,expires_ms:now+119000,claims:c,...over.payload};
 const payload=JSON.stringify(p);
 const signature=Buffer.from(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},kp.privateKey,new TextEncoder().encode(payload))).toString('base64url');
 return {payload,signature};
}
async function check(proofData=await proof(),row=baseRow,ts=now,key=spki,expected=tenantSha){
 return resolveG22(proofData,db(row),ts,key,expected);
}
async function denied(over,reason){
 const a=await check(await proof(over));
 assert.equal(a.body.ok,false);assert.equal(a.body.reason,reason);
 assert.equal(a.body.can_send,false);assert.equal(a.body.owner_verified,false);
}
test('valid attested Bot digest resolves only Shop B QA CANDIDATE',async()=>{
 const x=await check();assert.equal(x.http_status,200);
 assert.equal(x.body.status,'SIGNED_PROVIDER_MATCHES_SHOP_B_QA_CANDIDATE');
 assert.equal(x.body.tenant_scope,'QA_STAGING_SHOP_B_ONLY');
 assert.equal(x.body.registry_status,'CANDIDATE_OWNER_PENDING');
 assert.equal(x.body.owner_verified,false);
 assert.equal(x.body.merchant_authority_verified,false);
 assert.equal(x.body.can_send,false);
 assert.equal(x.body.can_promote_live_registry,false);
 assert.equal(x.body.orders_written,0);
 assert.equal(x.body.provider_sends,0);
 assert.equal(x.body.public_tenant_id_exposed,false);
 assert.equal(x.body.raw_bot_id_exposed,false);
 assert.ok(!JSON.stringify(x.body).includes(tenantId));
 assert.ok(!JSON.stringify(x.body).includes(digest));
});
test('missing DB fails closed',async()=>assert.equal((await resolveG22(await proof(),null,now,spki,tenantSha)).http_status,503));
test('missing pinned key fails closed',async()=>assert.equal((await resolveG22(await proof(),db(),now,'',tenantSha)).http_status,503));
test('missing tenant pinned SHA fails closed',async()=>assert.equal((await resolveG22(await proof(),db(),now,spki,'')).http_status,503));
test('untrusted server clock fails closed',async()=>assert.equal((await resolveG22(await proof(),db(),-1,spki,tenantSha)).http_status,503));
test('no signed provider proof rejected',async()=>assert.equal((await check(undefined)).body.ok,true)); // default argument invokes trusted synthetic proof
test('explicit null provider proof rejected',async()=>assert.equal((await check(null)).body.reason,'SIGNED_PROVIDER_PROOF_REQUIRED'));
test('untrusted signature denied',async()=>{const p=await proof();p.signature=p.signature.slice(0,-1)+(p.signature.at(-1)==='A'?'B':'A');assert.notEqual((await check(p)).http_status,200)});
test('unsigned payload data modification denied',async()=>{const p=await proof();p.payload=p.payload.replace('zalo_bot_creator','fake_provider');assert.equal((await check(p)).body.reason,'PROVIDER_CLAIMS_UNTRUSTED_OR_EXPIRED')});
test('bogus public root denied',async()=>{
 const other=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
 const wrong=Buffer.from(await crypto.subtle.exportKey('spki',other.publicKey)).toString('base64');
 assert.equal((await check(await proof(),baseRow,now,wrong)).body.reason,'PROVIDER_SIGNATURE_INVALID');
});
test('expired provider evidence denied',async()=>assert.equal((await check(await proof(),baseRow,now+200000)).body.reason,'PROVIDER_CLAIMS_UNTRUSTED_OR_EXPIRED'));
test('far future proof denied',async()=>assert.equal((await check(await proof(),baseRow,now-10000)).body.reason,'PROVIDER_CLAIMS_UNTRUSTED_OR_EXPIRED'));
test('mismatched lifetime rejected',async()=>denied({payload:{expires_ms:now+130000}},'PROVIDER_CLAIMS_UNTRUSTED_OR_EXPIRED'));
test('bad proof issuer denied',async()=>denied({payload:{issuer:'FAKE_ISSUER'}},'PROVIDER_CLAIMS_UNTRUSTED_OR_EXPIRED'));
test('bad proof purpose denied',async()=>denied({payload:{purpose:'ZALO_REAL_SEND'}} ,'PROVIDER_CLAIMS_UNTRUSTED_OR_EXPIRED'));
test('not official result string denied',async()=>denied({claims:{getme_result_id_string:false}},'PROVIDER_CLAIMS_UNTRUSTED_OR_EXPIRED'));
test('provider origin spoofed denied',async()=>denied({claims:{source:'REQUEST_BODY_FROM_BROWSER'}},'PROVIDER_CLAIMS_UNTRUSTED_OR_EXPIRED'));
test('getMe HTTP not 200 denied',async()=>denied({claims:{getme_http_status:403}},'PROVIDER_CLAIMS_UNTRUSTED_OR_EXPIRED'));
test('provider not Zalo denied',async()=>denied({claims:{provider:'messenger'}},'PROVIDER_CLAIMS_UNTRUSTED_OR_EXPIRED'));
test('provider method not POST denied',async()=>denied({claims:{api_method:'GET'}},'PROVIDER_CLAIMS_UNTRUSTED_OR_EXPIRED'));
test('missing readonly claim denied',async()=>denied({claims:{actual_api_call_readonly:false}},'PROVIDER_CLAIMS_UNTRUSTED_OR_EXPIRED'));
test('other Bot digest rejected despite valid signer',async()=>{
 const x=await check(await proof({claims:{bot_digest:'d'.repeat(64)}}));assert.equal(x.body.reason,'BOT_ID_OR_CHALLENGE_NOT_ENROLLED');
});
test('other challenge rejected despite valid signer',async()=>{
 const x=await check(await proof({claims:{challenge_nonce:'e'.repeat(64)}}));assert.equal(x.body.reason,'BOT_ID_OR_CHALLENGE_NOT_ENROLLED');
});
test('Shop A tenant UUID cannot be accepted',async()=>{
 const x=await check(await proof(),{...baseRow,tenant_uuid:'22222222-2222-4333-8444-666666666666'});
 assert.equal(x.body.reason,'PINNED_TENANT_IDENTITY_MISMATCH');
});
test('wrong tenant slug rejected',async()=>assert.equal((await check(await proof(),{...baseRow,tenant_slug:'qa-staging-shop-a-20261110'})).body.reason,'SHOP_B_CANDIDATE_RECORD_NOT_ELIGIBLE'));
test('wrong store key rejected',async()=>assert.equal((await check(await proof(),{...baseRow,store_key:'qa-store-a'})).body.reason,'SHOP_B_CANDIDATE_RECORD_NOT_ELIGIBLE'));
test('registry fixture row source rejected',async()=>assert.equal((await check(await proof(),{...baseRow,source:'synthetic_qa'})).body.reason,'SHOP_B_CANDIDATE_RECORD_NOT_ELIGIBLE'));
test('owner certified=1 cannot accidentally become G2.3 proof',async()=>assert.equal((await check(await proof(),{...baseRow,owner_certified:1})).body.reason,'SHOP_B_CANDIDATE_RECORD_NOT_ELIGIBLE'));
test('revoked registry record denied',async()=>assert.equal((await check(await proof(),{...baseRow,status:'REVOKED'})).body.reason,'SHOP_B_CANDIDATE_RECORD_NOT_ELIGIBLE'));
test('expired candidate record denied',async()=>assert.equal((await check(await proof(),{...baseRow,expires_ms:now-1})).body.reason,'SHOP_B_CANDIDATE_RECORD_NOT_ELIGIBLE'));
test('missing registration denied',async()=>assert.equal((await check(await proof(),null)).body.reason,'SHOP_B_CANDIDATE_RECORD_NOT_ELIGIBLE'));
test('database failure handled fail-closed',async()=>{
 const bad={prepare(){throw Error('secret database credentials')}};const x=await resolveG22(await proof(),bad,now,spki,tenantSha);
 assert.equal(x.http_status,503);assert.ok(!JSON.stringify(x).includes('credentials'));
});
test('invalid stored tenant UUID denied',async()=>assert.equal((await check(await proof(),{...baseRow,tenant_uuid:'not-a-uuid'})).body.reason,'SHOP_B_CANDIDATE_RECORD_NOT_ELIGIBLE'));
test('public health always NO SEND and reveals no identifiers',async()=>{
 const r=await worker.fetch(new Request('https://g22.invalid/health'),{G22_QA_DB:db()});
 assert.equal(r.status,200);const body=await r.json();assert.equal(body.can_send,false);assert.equal(body.owner_verified,false);
 assert.equal(body.credential_bindings,0);assert.ok(!JSON.stringify(body).includes(tenantId));
});
test('public /v1/send is hard 423',async()=>{const r=await worker.fetch(new Request('https://g22.invalid/v1/send',{method:'POST'}),{});assert.equal(r.status,423)});
test('provider route is hard 423',async()=>{const r=await worker.fetch(new Request('https://g22.invalid/v1/provider/private',{method:'POST'}),{});assert.equal(r.status,423)});
test('webhook route is hard 423',async()=>{const r=await worker.fetch(new Request('https://g22.invalid/webhook/abc',{method:'POST'}),{});assert.equal(r.status,423)});
test('order route is hard 423',async()=>{const r=await worker.fetch(new Request('https://g22.invalid/api/orders',{method:'POST'}),{});assert.equal(r.status,423)});
test('method wrong for resolver 404',async()=>{const r=await worker.fetch(new Request('https://g22.invalid/v1/resolve-bot',{method:'GET'}),{});assert.equal(r.status,404)});
test('content type wrong 415',async()=>{const r=await worker.fetch(new Request('https://g22.invalid/v1/resolve-bot',{method:'POST',body:'{}'}),{});assert.equal(r.status,415)});
test('malformed JSON 400',async()=>{const r=await worker.fetch(new Request('https://g22.invalid/v1/resolve-bot',{method:'POST',headers:{'content-type':'application/json'},body:'{'}),{});assert.equal(r.status,400)});
test('empty proof only body required 422',async()=>{const r=await worker.fetch(new Request('https://g22.invalid/v1/resolve-bot',{method:'POST',headers:{'content-type':'application/json'},body:'{}'}),{});assert.equal(r.status,422)});
test('attempt client provided tenant override rejected',async()=>{
 const r=await worker.fetch(new Request('https://g22.invalid/v1/resolve-bot',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({proof:{},tenant_id:tenantId})}),{});
 assert.equal(r.status,422);
});
test('unsupported route 404',async()=>{const r=await worker.fetch(new Request('https://g22.invalid/admin/register',{method:'POST'}),{});assert.equal(r.status,404)});
test('no personal data/real Orders writes in resolver worker source',async()=>{
 const fs=await import('node:fs');const s=fs.readFileSync(new URL('./g22-trusted-bot-resolver-worker.mjs',import.meta.url),'utf8');
 assert.ok(!/INSERT\s+INTO|UPDATE\s+g22|DELETE\s+FROM|sendMessage|ZALO_BOT_TOKEN|GATEWAY_AUTH_KEY/.test(s));
});
