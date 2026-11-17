import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {assessPrivateOwnershipBundle,realHostedDecision} from './private-ownership-proof.mjs';
const keys=()=>{const x=generateKeyPairSync('ed25519');return {sk:x.privateKey,pk:x.publicKey.export({format:'pem',type:'spki'})}};
const ko=keys(),ks=keys(),kf=keys(),fake=keys(),now=2000000000;
const context={tenant_id:'tenant-qa-01',store_a:'store-qa-A',store_b:'store-qa-B',merchant_ref:'merchant-qa-01',operator_sub:'operator-qa-01'};
const common={aud:'tien404-rpc177-private-qa',iat:now-30,exp:now+60,scope:'review.disposable.no_send',...context};
const make=(data,k,kid)=>{const payload=Buffer.from(JSON.stringify(data)).toString('base64url');return {kid,payload,signature:sign(null,Buffer.from(payload,'base64url'),k).toString('base64url')}};
const p=(role,n)=>({...common,role,approval_id:'approval-qa-'+n,nonce:'nonce-qa-'+n});
const args=()=>({owner:make(p('merchant_owner','01'),ko.sk,'OWNER'),security:make(p('security_reviewer','02'),ks.sk,'SEC'),finance:make(p('finance_delegate','03'),kf.sk,'FIN'),ownerPins:{OWNER:ko.pk},securityPins:{SEC:ks.pk},financePins:{FIN:kf.pk},context,now});
const blocked=x=>{for(const k of ['can_migrate','can_issue_tokens','can_read_merchant_files','can_upload','can_send','can_change_access'])assert.equal(x[k],false)};
test('valid synthetic independent signatures never permit migration or real Merchant access',()=>{const x=assessPrivateOwnershipBundle(args());assert.equal(x.accepted,true);blocked(x)});
for(const [label,patch] of [
 ['wrong store',{store_b:'store-qa-C'}],['wrong tenant',{tenant_id:'tenant-qa-02'}],
 ['wrong merchant',{merchant_ref:'merchant-qa-02'}],['wrong operator',{operator_sub:'operator-qa-02'}],
 ['wrong scope',{scope:'migrate.prod'}],['wrong audience',{aud:'public'}],
 ['wrong role',{role:'merchant_owner'}],['expired',{exp:now}],['future issued',{iat:now+1}],
 ['excess TTL',{exp:now+181}],['extra claim',{admin:true}]
])test('reject modified security proof '+label,()=>{const x=args();x.security=make({...p('security_reviewer','02'),...patch},ks.sk,'SEC');assert.equal(assessPrivateOwnershipBundle(x).accepted,false);blocked(assessPrivateOwnershipBundle(x))});
test('reject unknown kid',()=>{const x=args();x.owner={...x.owner,kid:'UNKNOWN'};assert.equal(assessPrivateOwnershipBundle(x).accepted,false)});
test('reject forged signature',()=>{const x=args();x.finance=make(p('finance_delegate','03'),fake.sk,'FIN');assert.equal(assessPrivateOwnershipBundle(x).accepted,false)});
test('reject missing owner proof',()=>{const x=args();delete x.owner;assert.equal(assessPrivateOwnershipBundle(x).accepted,false)});
test('reject same signing authority reused',()=>{const x=args();x.security=make(p('security_reviewer','02'),ko.sk,'OWNER');x.securityPins={OWNER:ko.pk};assert.equal(assessPrivateOwnershipBundle(x).accepted,false)});
test('reject duplicated approval ids',()=>{const x=args();x.security=make({...p('security_reviewer','02'),approval_id:'approval-qa-01'},ks.sk,'SEC');assert.equal(assessPrivateOwnershipBundle(x).accepted,false)});
test('reject duplicated nonce',()=>{const x=args();x.finance=make({...p('finance_delegate','03'),nonce:'nonce-qa-01'},kf.sk,'FIN');assert.equal(assessPrivateOwnershipBundle(x).accepted,false)});
test('reject same Store A/B',()=>{const x=args();x.context={...context,store_b:context.store_a};assert.equal(assessPrivateOwnershipBundle(x).accepted,false)});
test('reject absent and null input',()=>{assert.equal(assessPrivateOwnershipBundle().accepted,false);assert.equal(assessPrivateOwnershipBundle(null).accepted,false)});
test('hosted always denies migration',()=>{const x=realHostedDecision();assert.equal(x.accepted,false);blocked(x)});
