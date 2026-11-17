import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {verifyInvite,checkFileEnvelope,createMockAdmissionLimiter,hostedDecision} from './private-admission.mjs';
const {publicKey,privateKey}=generateKeyPairSync('ed25519');
const {privateKey:attackerPrivate}=generateKeyPairSync('ed25519');
const pinned={K1:publicKey.export({format:'pem',type:'spki'})};
const context={issuer:'tien404-private-broker',tenant_id:'tenant-qa',store_id:'store-A',operator_sub:'operator-A'};
const t=2000000000;
const claims={aud:'tien404-rpc17-offline-qa',exp:t+120,iat:t,invitation_id:'invite-0001',issuer:context.issuer,nonce:'nonce-00001',operator_sub:context.operator_sub,scope:'merchant.evidence.preflight',store_id:context.store_id,tenant_id:context.tenant_id};
const packet=(c=claims,key=privateKey,kid='K1')=>{const payload=Buffer.from(JSON.stringify(c)).toString('base64url');return {kid,payload,signature:sign(null,Buffer.from(payload,'base64url'),key).toString('base64url')}};
test('valid signed invitation is offline only',()=>{const v=verifyInvite(packet(),context,pinned,t*1000);assert.equal(v.accepted,true);assert.equal(v.can_upload,false);assert.equal(v.can_open_access,false);assert.equal(v.can_send,false)});
for(const [name,fn] of [
 ['unsigned',()=>({...packet(),signature:''})],['attacker key',()=>packet(claims,attackerPrivate)],['untrusted kid',()=>packet(claims,privateKey,'K2')],['tampered payload',()=>({...packet(),payload:packet({...claims,store_id:'store-B'}).payload})],['wrong store',()=>packet({...claims,store_id:'store-B'})],['wrong tenant',()=>packet({...claims,tenant_id:'tenant-B'})],['wrong operator',()=>packet({...claims,operator_sub:'operator-B'})],['wrong audience',()=>packet({...claims,aud:'another-audience'})],['wrong scope',()=>packet({...claims,scope:'merchant.evidence.upload'})],['expired',()=>packet({...claims,exp:t-1})],['long TTL',()=>packet({...claims,exp:t+301})],['unknown claim',()=>packet({...claims,admin:true})]
])test(`deny ${name}`,()=>{const r=verifyInvite(fn(),context,pinned,t*1000);assert.equal(r.accepted,false);assert.equal(r.can_upload,false)});
test('identity wrong and invalid input deny',()=>{assert.equal(verifyInvite(packet(),{...context,issuer:'evil-issuer'},pinned,t*1000).accepted,false);assert.equal(verifyInvite(null,context,pinned).accepted,false)});
const pdf={name:'document.pdf',mime:'application/pdf',size:100,head:Buffer.from('%PDF-1.7')};
test('PDF signature is preflight only',()=>{const r=checkFileEnvelope(pdf);assert.equal(r.accepted,true);assert.equal(r.can_upload,false)});
test('PNG signature is preflight only',()=>{const r=checkFileEnvelope({name:'a.png',mime:'image/png',size:100,head:Buffer.from([137,80,78,71,13,10,26,10])});assert.equal(r.accepted,true);assert.equal(r.can_upload,false)});
test('JPEG signature is preflight only',()=>{const r=checkFileEnvelope({name:'a.jpg',mime:'image/jpeg',size:100,head:Buffer.from([255,216,255])});assert.equal(r.accepted,true);assert.equal(r.can_upload,false)});
for(const [name,file] of [['executable',{...pdf,name:'evil.exe'}],['mime confusion',{...pdf,mime:'image/png'}],['traversal',{...pdf,name:'../x.pdf'}],['too large',{...pdf,size:6000000}],['zero',{...pdf,size:0}],['malformed',{...pdf,head:Buffer.from('NOTPDF')}],['double extension',{...pdf,name:'evil.pdf.exe'}]])test(`reject file ${name}`,()=>assert.equal(checkFileEnvelope(file).accepted,false));
test('mock replay and rate limitation',()=>{const l=createMockAdmissionLimiter({limit:2});assert.equal(l.check({key:'A',nonce:'n1',now:100}).accepted,true);assert.equal(l.check({key:'A',nonce:'n1',now:101}).reason,'REPLAY');assert.equal(l.check({key:'A',nonce:'n2',now:102}).accepted,true);assert.equal(l.check({key:'A',nonce:'n3',now:103}).reason,'RATE_LIMIT');assert.equal(l.check({key:'B',nonce:'n4',now:104}).accepted,true);assert.equal(l.check({key:'A',nonce:'n5',now:100000}).accepted,true)});
test('hosted ALWAYS NO GO',()=>{assert.equal(hostedDecision().can_upload,false);assert.equal(hostedDecision().accepted,false)});
