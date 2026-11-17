import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {OBSERVATION,BIO_RPC_NAMES,PRIVILEGED_COMMERCE_NAMES,NATIVE_INGRESS_PROOFS,classifyBioRpcNames,evaluateDeployedRoutes,verifyMetaSyntheticFixture,assessNativeIngress} from './deployed-route-ingress.mjs';
test('BIO static names classify but never authorize revoke',()=>{const r=classifyBioRpcNames(BIO_RPC_NAMES);assert.equal(r.status,'BIO_STATIC_NAMES_CLASSIFIED');assert.equal(r.canRevoke,false)});
for(const name of PRIVILEGED_COMMERCE_NAMES)test('privileged name flagged '+name,()=>{const r=classifyBioRpcNames([...BIO_RPC_NAMES,name]);assert.equal(r.privilegedTargetFound,true);assert.equal(r.canRevoke,false)});
test('unknown dynamic RPC needs review',()=>assert.equal(classifyBioRpcNames(['DYNAMIC_RPC_NAME']).status,'REVIEW_REQUIRED'));
test('null RPC names rejected',()=>assert.equal(classifyBioRpcNames(null).status,'REVIEW_REQUIRED'));
test('observed routes are not independently admitted',()=>{const x=evaluateDeployedRoutes(OBSERVATION);assert.equal(x.status,'DEPLOYMENT_REVIEW_NOT_ACCEPTED');assert.equal(x.canChangeRoutes,false)});
test('all claimed route flags still no-go',()=>{const x=evaluateDeployedRoutes({...OBSERVATION,zoneRoutesComplete:true,deploymentSourceHashVerified:true,externalCallersAudited:true,trafficPathRealVerified:true});assert.ok(x.blockers.includes('INDEPENDENT_PRIVATE_ROUTE_ACCEPTANCE_NOT_PRESENT'));assert.equal(x.canRevokeRpc,false)});
for(const key of Object.keys(OBSERVATION))test('route drift '+key,()=>{const old=OBSERVATION[key],x=evaluateDeployedRoutes({...OBSERVATION,[key]:typeof old==='number'?old+1:'CHANGED'});assert.ok(x.blockers.includes('REVERIFY_'+key.toUpperCase()))});
const secret='FIXTURE_ONLY_NOT_A_PROVIDER_SECRET_1234',raw=Buffer.from('{"object":"page","entry":[{"id":"SYNTHETIC"}]}'),sig='sha256='+createHmac('sha256',secret).update(raw).digest('hex');
const metaCases=[
 ['matching synthetic HMAC',raw,sig,secret,true],
 ['mutated bytes',Buffer.concat([raw,Buffer.from(' ')]),sig,secret,false],
 ['wrong secret',raw,sig,secret+'X',false],
 ['sha1 header',raw,'sha1='+sig.slice(7),secret,false],
 ['empty body',Buffer.alloc(0),sig,secret,false],
 ['string body',raw.toString(),sig,secret,false],
 ['large payload',Buffer.alloc(65537),sig,secret,false],
 ['missing secret',raw,sig,undefined,false],
 ['short secret',raw,sig,'tiny',false],
 ['bad hex',raw,'sha256='+'z'.repeat(64),secret,false],
 ['uppercase digest',raw,sig.toUpperCase(),secret,false]
];
for(const [title,body,header,appSecret,expected] of metaCases)test('Meta fixture '+title,()=>assert.equal(verifyMetaSyntheticFixture({rawBody:body,header,appSecret}),expected));
for(const provider of ['meta-messenger','zalo-bot','zalo-oa']){
 test(provider+' all self-declared proof remains no-go',()=>{const x=assessNativeIngress(provider,Object.fromEntries(NATIVE_INGRESS_PROOFS.map(k=>[k,true])));assert.equal(x.realNativeSignatureVerified,false);assert.equal(x.canSend,false)});
 for(const k of NATIVE_INGRESS_PROOFS)test(provider+' missing '+k,()=>{const a=Object.fromEntries(NATIVE_INGRESS_PROOFS.map(z=>[z,true]));a[k]=false;assert.ok(assessNativeIngress(provider,a).reasons.includes('MISSING_'+k.toUpperCase()))});
}
for(const key of ['rawBody','signature','token','secret','accessToken','customerId','ownerDocument','providerEvent','jwt'])
 test('private value not echoed '+key,()=>{const x=assessNativeIngress('zalo-bot',{[key]:'CONFIDENTIAL_CANARY'});assert.ok(x.reasons.includes('PRIVATE_INPUT_REJECTED'));assert.ok(!JSON.stringify(x).includes('CONFIDENTIAL_CANARY'))});
test('unknown provider refused',()=>assert.ok(assessNativeIngress('bad',{}).reasons.includes('PROVIDER_UNSUPPORTED')));
