import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {reviewSignedGoNoGoPacket,actualMigrationDecision} from './signed-admission.mjs';
const roles=['owner','recovery','security'];
const key=()=>{const v=generateKeyPairSync('ed25519');return {privateKey:v.privateKey,publicKeyPem:v.publicKey.export({type:'spki',format:'pem'})}};
const keys=Object.fromEntries(roles.map(r=>[r,key()]));
const a='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const b='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2';
const tenant='11111111-1111-4111-8111-111111111111';
const ctx={project:'ifxlvrhyjhbzbrkdsida',schema:'rpc178_qa',baseline_sha256:'53b0943b3bf5f6f069eeeed379ff1f1ead1e4fb94b4b32faea2e7c85f6fdcc2d',candidate_sha256:'a'.repeat(64),store_a:a,store_b:b,tenant_id:tenant};
const now=2000000000;
const makePayload=(role)=>({
 aud:'tien404-rpc178d-private-review',baseline_sha256:ctx.baseline_sha256,candidate_sha256:ctx.candidate_sha256,
 evidence_sha256:'b'.repeat(64),exp:now+120,iat:now-30,issuer_ref:'operator-'+role+'-QA01',
 nonce:'nonce-'+role+'-QA01-12345',project:ctx.project,role,schema:ctx.schema,
 scope:'rpc178_qa:review_no_send',store_a:a,store_b:b,tenant_id:tenant
});
const signed=(payload,sk,kid)=>{const bytes=Buffer.from(JSON.stringify(payload));return {kid,payload:bytes.toString('base64url'),signature:sign(null,bytes,sk).toString('base64url')}};
const args=()=>({
 context:{...ctx},now,
 trustedPins:Object.fromEntries(roles.map(r=>[r,{kid:r+'-independent-QA',publicKeyPem:keys[r].publicKeyPem}])),
 attestations:Object.fromEntries(roles.map(r=>[r,signed(makePayload(r),keys[r].privateKey,r+'-independent-QA')]))
});
const deny=x=>{assert.equal(x.can_apply_ddl,false);assert.equal(x.can_create_store,false);assert.equal(x.can_change_rls,false);assert.equal(x.can_restore_staging,false);assert.equal(x.can_use_real_jwt,false);assert.equal(x.can_send,false);assert.equal(x.can_open_access,false)};
test('3 independently signed SYNTHETIC proofs show review readiness, never migration GO',()=>{
 const x=reviewSignedGoNoGoPacket(args());assert.equal(x.signed_packet_valid,true);
 assert.equal(x.status,'SIGNED_PACKET_REVIEW_READY_NOT_GO');deny(x);
});
test('no packet is no-go',()=>{const x=reviewSignedGoNoGoPacket();assert.equal(x.status,'NO_GO');deny(x)});
test('null packet is no-go',()=>{const x=reviewSignedGoNoGoPacket(null);assert.equal(x.status,'NO_GO');deny(x)});
for(const role of roles)test('missing '+role+' blocks',()=>{const x=args();delete x.attestations[role];const r=reviewSignedGoNoGoPacket(x);assert.equal(r.status,'NO_GO');deny(r)});
for(const [name,change] of [
 ['wrong schema',x=>x.context.schema='public'],
 ['wrong project',x=>x.context.project='another-project'],
 ['wrong baseline hash',x=>x.context.baseline_sha256='c'.repeat(64)],
 ['wrong migration hash',x=>x.context.candidate_sha256='d'.repeat(64)],
 ['two equal Store IDs',x=>x.context.store_b=x.context.store_a],
 ['invalid Store ID',x=>x.context.store_a='qa-store-a'],
 ['wrong tenant',x=>x.context.tenant_id='wrong'],
 ['stale time',x=>x.now+=400]
])test('reject '+name,()=>{const x=args();change(x);const r=reviewSignedGoNoGoPacket(x);assert.equal(r.status,'NO_GO');deny(r)});
for(const [name,patch] of [
 ['wrong audience',{aud:'public'}],['wrong role',{role:'owner'}],
 ['wrong scope',{scope:'rpc178_qa:migrate'}],['mismatched tenant',{tenant_id:'22222222-2222-4222-8222-222222222222'}],
 ['mismatched Store',{store_b:'cccccccc-cccc-4ccc-8ccc-ccccccccccc3'}],
 ['short TTL expired',{exp:now}],['future issue',{iat:now+30}],
 ['long TTL',{exp:now+1000}],['unknown issuer',{issuer_ref:'bad-issuer'}],
 ['unexpected raw JWT claim',{raw_jwt:'NEVER'}]
])test('reject tampered recovery proof '+name,()=>{const x=args();x.attestations.recovery=signed({...makePayload('recovery'),...patch},keys.recovery.privateKey,'recovery-independent-QA');const r=reviewSignedGoNoGoPacket(x);assert.equal(r.status,'NO_GO');deny(r)});
test('invalid signature cannot be forged with claimed key',()=>{const x=args();x.attestations.security=signed(makePayload('security'),keys.owner.privateKey,'security-independent-QA');const r=reviewSignedGoNoGoPacket(x);assert.equal(r.status,'NO_GO');deny(r)});
test('signer keys reused instead of independent keys',()=>{const x=args();x.trustedPins.security={kid:'owner-independent-QA',publicKeyPem:keys.owner.publicKeyPem};x.attestations.security=signed(makePayload('security'),keys.owner.privateKey,'owner-independent-QA');const r=reviewSignedGoNoGoPacket(x);assert.equal(r.status,'NO_GO');deny(r)});
test('duplicate signer identity denied',()=>{const x=args();x.attestations.security=signed({...makePayload('security'),issuer_ref:'operator-owner-QA01'},keys.security.privateKey,'security-independent-QA');const r=reviewSignedGoNoGoPacket(x);assert.equal(r.status,'NO_GO');deny(r)});
test('duplicate nonce denied',()=>{const x=args();x.attestations.security=signed({...makePayload('security'),nonce:makePayload('owner').nonce},keys.security.privateKey,'security-independent-QA');const r=reviewSignedGoNoGoPacket(x);assert.equal(r.status,'NO_GO');deny(r)});
test('real migration decision remains hard denied',()=>deny(actualMigrationDecision()));
