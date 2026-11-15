import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {createRequire} from 'node:module';
import {makeProviderEvidence} from './g2-provider-identity-attestor.mjs';
const require=createRequire(import.meta.url);
const {verifyProof,ISSUER}=require('./live03-identity-budget-gate.cjs');
globalThis.crypto ||= webcrypto;
const now=Date.now(),nonce='8'.repeat(64),id='1459232241454765289';// Official docs EXAMPLE, not user's bot ID
const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
const hmac=await crypto.subtle.generateKey({name:'HMAC',hash:'SHA-256',length:256},false,['sign','verify']);
const publicJwk=await crypto.subtle.exportKey('jwk',pair.publicKey);
const jwkPub={...publicJwk};delete jwkPub.d;
const pki=await crypto.subtle.exportKey('spki',pair.publicKey);
const pub='-----BEGIN PUBLIC KEY-----\n'+Buffer.from(pki).toString('base64').match(/.{1,64}/g).join('\n')+'\n-----END PUBLIC KEY-----';
const g={
 trustedGetMe:async()=>({origin:'SERVER_HTTPS_ZALO_GETME',httpStatus:200,body:{ok:true,result:{id,account_name:'SYNTHETIC TEST BOT'}}}),
 signingKey:pair.privateKey,identityHmacKey:hmac,
 scope:{trustedServerOrigin:'PRIVATE_TOKEN_HOLDER_POST_AUTH',tenant_digest:'1'.repeat(64),store_digest:'2'.repeat(64),owner_digest:'3'.repeat(64)},
 nonce,nowMs:now
};
test('provider evidence signed by ephemeral ECDSA private key verifies in existing LIVE03 verifier',async()=>{
 const r=await makeProviderEvidence(g);
 assert.equal(r.status,'SIGNED_PROVIDER_OBSERVATION_ONLY');
 const claims=verifyProof('provider',r.proof,{[ISSUER.provider]:pub},now);
 assert.equal(claims.source,'SERVER_HTTPS_ZALO_GETME');
 assert.equal(claims.getme_result_id_string,true);
 assert.equal(claims.bot_digest.length,64);
 assert.equal(claims.challenge_nonce,nonce);
 assert.equal(r.can_send,false);
 assert.equal(r.can_promote_registry,false);
 assert.equal(r.provider_sends,0);
 assert.ok(!JSON.stringify(r).includes(id));
 assert.ok(!JSON.stringify(r).includes('SYNTHETIC TEST BOT'));
});
test('nonce changes bot HMAC digest and binding',async()=>{
 const a=await makeProviderEvidence(g);
 const b=await makeProviderEvidence({...g,nonce:'9'.repeat(64)});
 assert.notEqual(JSON.parse(a.proof.payload).claims.bot_digest,JSON.parse(b.proof.payload).claims.bot_digest);
});
test('no trusted GetMe callback fail closed',async()=>assert.equal((await makeProviderEvidence({...g,trustedGetMe:null})).status,'BLOCKED'));
test('no signing key fail closed',async()=>assert.equal((await makeProviderEvidence({...g,signingKey:null})).status,'BLOCKED'));
test('wrong signing key type fail closed',async()=>assert.equal((await makeProviderEvidence({...g,signingKey:hmac})).status,'BLOCKED'));
test('missing HMAC key fail closed',async()=>assert.equal((await makeProviderEvidence({...g,identityHmacKey:null})).status,'BLOCKED'));
test('HMAC key swapped with ECDSA fail closed',async()=>assert.equal((await makeProviderEvidence({...g,identityHmacKey:pair.privateKey})).status,'BLOCKED'));
test('client-derived scope denied',async()=>assert.equal((await makeProviderEvidence({...g,scope:{...g.scope,trustedServerOrigin:'UNTRUSTED_WEBHOOK'}})).status,'BLOCKED'));
test('invalid digest length denied',async()=>assert.equal((await makeProviderEvidence({...g,scope:{...g.scope,owner_digest:'BAD'}})).status,'BLOCKED'));
test('invalid challenge denied',async()=>assert.equal((await makeProviderEvidence({...g,nonce:'0000'})).status,'BLOCKED'));
test('invalid server clock denied',async()=>assert.equal((await makeProviderEvidence({...g,nowMs:-1})).status,'BLOCKED'));
test('status 401 blocks',async()=>assert.equal((await makeProviderEvidence({...g,trustedGetMe:async()=>({origin:'SERVER_HTTPS_ZALO_GETME',httpStatus:401,body:{ok:false}})})).status,'BLOCKED'));
test('response from caller not authenticated provider denied',async()=>assert.equal((await makeProviderEvidence({...g,trustedGetMe:async()=>({origin:'USER_PROVIDED_FAKE',httpStatus:200,body:{ok:true,result:{id}}})})).status,'BLOCKED'));
test('provider ok false blocks',async()=>assert.equal((await makeProviderEvidence({...g,trustedGetMe:async()=>({origin:'SERVER_HTTPS_ZALO_GETME',httpStatus:200,body:{ok:false,result:{id}}})})).status,'BLOCKED'));
test('getMe token valid boolean cannot substitute immutable id',async()=>assert.equal((await makeProviderEvidence({...g,trustedGetMe:async()=>({origin:'SERVER_HTTPS_ZALO_GETME',httpStatus:200,body:{ok:true,bot_token_valid:true}})})).status,'BLOCKED'));
test('numeric Bot ID rejected to avoid JS precision loss',async()=>assert.equal((await makeProviderEvidence({...g,trustedGetMe:async()=>({origin:'SERVER_HTTPS_ZALO_GETME',httpStatus:200,body:{ok:true,result:{id:Number(id)}}})})).status,'BLOCKED'));
test('invalid provider ID rejected',async()=>assert.equal((await makeProviderEvidence({...g,trustedGetMe:async()=>({origin:'SERVER_HTTPS_ZALO_GETME',httpStatus:200,body:{ok:true,result:{id:'b'}}})})).status,'BLOCKED'));
test('provider exception never leaks credential-bearing error text',async()=>{
 const r=await makeProviderEvidence({...g,trustedGetMe:async()=>{throw Error('SECRETS_ZALO_TOKEN_123')}});
 assert.equal(r.status,'BLOCKED');assert.equal(r.reason,'PROVIDER_READ_OR_SIGN_FAILED');
 assert.ok(!JSON.stringify(r).includes('SECRETS_ZALO_TOKEN_123'));
});
