import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {authorizeOperatorOffline,hostedSecurityDecision} from './operator-authority.mjs';
const create=()=>{const p=generateKeyPairSync('ed25519');return {privateKey:p.privateKey,publicKey:p.publicKey.export({type:'spki',format:'pem'})}};
const operator=create(),owner=create(),attacker=create(),now=2000000000;
const expected={operator_issuer:'broker-private',store_issuer:'store-registry',tenant_id:'tenant-qa-1',store_id:'store-A-qa',operator_sub:'operator-qa-1',owner_version:'ownership-v1',session_id:'session-qa-1'};
const op={aud:'tien404-rpc173-operator-offline',auth_time:now-30,exp:now+90,iat:now-30,issuer:expected.operator_issuer,mfa:true,operator_sub:expected.operator_sub,role:'merchant-owner',session_id:expected.session_id,store_id:expected.store_id,tenant_id:expected.tenant_id};
const st={aud:'tien404-rpc173-store-offline',exp:now+90,iat:now-30,issuer:expected.store_issuer,operator_sub:expected.operator_sub,owner_version:expected.owner_version,role:'merchant-owner',store_id:expected.store_id,tenant_id:expected.tenant_id};
function packet(x,key,kid){const payload=Buffer.from(JSON.stringify(x)).toString('base64url');return {kid,payload,signature:sign(null,Buffer.from(payload,'base64url'),key).toString('base64url')}}
const request=()=>({operatorPacket:packet(op,operator.privateKey,'OP'),storePacket:packet(st,owner.privateKey,'OW'),operatorPins:{OP:operator.publicKey},storePins:{OW:owner.publicKey},expected,now});
const assertDenied=v=>{assert.equal(v.accepted,false);for(const k of ['can_upload','can_send','can_open_access','can_deploy'])assert.equal(v[k],false)};
test('two pinned independent test authorities yield offline pre-admission only',()=>{const x=authorizeOperatorOffline(request());assert.equal(x.accepted,true);for(const k of ['can_upload','can_send','can_open_access','can_deploy'])assert.equal(x[k],false)});
for(const [label,changes] of [
 ['operator impersonation',{operator_sub:'operator-bad'}],['store mismatch',{store_id:'store-B-qa'}],['tenant mismatch',{tenant_id:'tenant-qa-2'}],
 ['stale MFA',{auth_time:now-301}],['no MFA',{mfa:false}],['future MFA',{auth_time:now+1}],
 ['wrong operator audience',{aud:'wrong-audience'}],['wrong role',{role:'viewer-qa'}],['wrong session',{session_id:'session-bad'}],
 ['future issue time',{iat:now+1}],['expired',{exp:now}],['extended TTL',{exp:now+121}],['extra admin flag',{admin:true}]
])test('reject operator '+label,()=>{const x=request();x.operatorPacket=packet({...op,...changes},operator.privateKey,'OP');assertDenied(authorizeOperatorOffline(x))});
for(const [label,changes] of [
 ['different tenant',{tenant_id:'tenant-qa-2'}],['different store',{store_id:'store-B-qa'}],
 ['different operator',{operator_sub:'operator-bad'}],['wrong role',{role:'viewer-qa'}],
 ['old ownership version',{owner_version:'ownership-v0'}],['wrong store audience',{aud:'wrong-audience'}],
 ['expired',{exp:now}],['extra claim',{admin:true}]
])test('reject store authority '+label,()=>{const x=request();x.storePacket=packet({...st,...changes},owner.privateKey,'OW');assertDenied(authorizeOperatorOffline(x))});
test('reject forged operator signature',()=>{const x=request();x.operatorPacket=packet(op,attacker.privateKey,'OP');assertDenied(authorizeOperatorOffline(x))});
test('reject forged store signature',()=>{const x=request();x.storePacket=packet(st,attacker.privateKey,'OW');assertDenied(authorizeOperatorOffline(x))});
test('reject unknown operator key',()=>{const x=request();x.operatorPacket={...x.operatorPacket,kid:'UNKNOWN'};assertDenied(authorizeOperatorOffline(x))});
test('reject same signing authority posing as independent store registry',()=>{const x=request();x.storePacket=packet(st,operator.privateKey,'OP');x.storePins={OP:operator.publicKey};assertDenied(authorizeOperatorOffline(x))});
test('reject untrusted context',()=>{const x=request();x.expected={...expected,store_id:'store-C-qa'};assertDenied(authorizeOperatorOffline(x))});
test('reject absent packets',()=>{assertDenied(authorizeOperatorOffline({}));assertDenied(authorizeOperatorOffline(null))});
test('never grant hosted action even with a positive synthetic assertion',()=>{assertDenied(hostedSecurityDecision())});
