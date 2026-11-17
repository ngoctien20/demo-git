import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,createHmac} from 'node:crypto';
import {BASELINE,BIO_PRODUCTION,BIO_STATIC_RPC_NAMES,COMMERCE_PRIVILEGED_NAMES,reconcileWorkerVersionMetadata,assessCallerCoverage,assessBioRpcNames} from './deployed-fingerprint-caller-closure.mjs';
import {verifyMetaSyntheticFixture,verifyZaloOaSyntheticDigest,verifyZaloBotSyntheticSecret,PRIVATE_CANARY_GATES,inspectPrivateCanary} from './native-provider-private-canary.mjs';

const validMeta={...BIO_PRODUCTION,scriptListETag:BIO_PRODUCTION.metadataScriptETag,versionResourceETag:BIO_PRODUCTION.metadataScriptETag};
test('Cloudflare metadata ETags match without claiming raw-byte version',()=>{
 const x=reconcileWorkerVersionMetadata(validMeta);
 assert.equal(x.status,'DEPLOYMENT_METADATA_STRUCTURALLY_RECONCILED');
 assert.equal(x.sourceByteEqualityProven,false);
 assert.equal(x.liveRequestTrafficIndependentlyProven,false);
 assert.equal(x.canChangeRoutes,false);
});
for(const key of ['script','customDomain','deployment','version','versionWeight','metadataScriptETag','extractedCurrentSourceSha256'])
 test('metadata drift '+key+' fails closed',()=>{const x=reconcileWorkerVersionMetadata({...validMeta,[key]:'FORGED'});assert.equal(x.status,'DEPLOYMENT_METADATA_REAUDIT')});
test('version resource and script list ETag mismatch blocked',()=>{
 const x=reconcileWorkerVersionMetadata({...validMeta,scriptListETag:'WRONG'});
 assert.ok(x.issues.includes('CLOUDFLARE_ETAG_PAIR_MISMATCH'));
});
test('version source hash not mistaken for ETag hash',()=>assert.notEqual(BIO_PRODUCTION.extractedCurrentSourceSha256,BIO_PRODUCTION.metadataScriptETag));
test('bounded inventories never authorize global caller closure',()=>{
 const x=assessCallerCoverage(BASELINE);assert.equal(x.status,'GLOBAL_CALLER_NO_GO');assert.equal(x.canRevokeRpc,false);assert.equal(x.allCallersIndependentlyVerified,false);
});
test('even all declared external proof still needs independent external acceptance',()=>{
 const x=assessCallerCoverage({...BASELINE,dynamicCodeCallsReviewed:true,externalClientCallersReviewed:true,productionRequestTraceIndependentlyVerified:true});
 assert.ok(x.blockers.includes('INDEPENDENT_EXTERNAL_CALLER_ACCEPTANCE_REQUIRED'));assert.equal(x.canChangePrivileges,false);
});
for(const key of Object.keys(BASELINE))
 test('inventory count drift '+key,()=>{const old=BASELINE[key],v=typeof old==='number'?old+1:'FORGED';const x=assessCallerCoverage({...BASELINE,[key]:v});assert.ok(x.blockers.includes('INVENTORY_CHANGED_'+key.toUpperCase()))});
test('BIO static personal names recognized',()=>{
 const x=assessBioRpcNames(BIO_STATIC_RPC_NAMES);assert.equal(x.status,'BIO_PERSONAL_RPC_STATIC_ONLY');assert.equal(x.dynamicRuntimeReviewRequired,true);assert.equal(x.canRevokeRpc,false);
});
for(const rpc of COMMERCE_PRIVILEGED_NAMES)test('BIO potential privileged '+rpc+' triggers review',()=>{
 const x=assessBioRpcNames([...BIO_STATIC_RPC_NAMES,rpc]);assert.equal(x.status,'NEEDS_MANUAL_REVIEW');assert.ok(x.privileged.includes(rpc));assert.equal(x.canRevokeRpc,false);
});
test('BIO dynamic unknown caller not cleared',()=>{const x=assessBioRpcNames(['variable_rpc']);assert.equal(x.status,'NEEDS_MANUAL_REVIEW')});
test('BIO wrong input rejected',()=>assert.equal(assessBioRpcNames(null).status,'INVALID_INPUT'));
test('unknown RPC input never echoed into the report',()=>{const x=assessBioRpcNames(['PRIVATE_SENSITIVE_DO_NOT_ECHO_012345']);assert.equal(x.status,'NEEDS_MANUAL_REVIEW');assert.equal(JSON.stringify(x).includes('PRIVATE_SENSITIVE_DO_NOT_ECHO_012345'),false)});

const metaRaw=Buffer.from('{"object":"page","entry":[{"id":"SYNTHETIC"}]}','utf8');
const metaSecret='SYNTHETIC_META_APP_SECRET_NOT_REAL_12345';
const metaSig='sha256='+createHmac('sha256',metaSecret).update(metaRaw).digest('hex');
test('inherits original raw-body Meta SHA-256 HMAC synthetic fixture',()=>assert.equal(verifyMetaSyntheticFixture({rawBody:metaRaw,header:metaSig,appSecret:metaSecret}),true));
test('Meta tampering fails',()=>assert.equal(verifyMetaSyntheticFixture({rawBody:Buffer.concat([metaRaw,Buffer.from('\n')]),header:metaSig,appSecret:metaSecret}),false));

const appId='SYNTHETIC_OA_APP_123',oaSecret='SYNTHETIC_OA_SECRET_NOT_REAL_123456',timeStamp='1794920000000';
const rawOAData=Buffer.from('{"event_name":"user_send_text","data":"SYNTHETIC_ONLY"}','utf8');
function oaDigest(app=appId,data=rawOAData,time=timeStamp,secret=oaSecret){
 return createHash('sha256').update(Buffer.from(app)).update(data).update(Buffer.from(time)).update(Buffer.from(secret)).digest('hex');
}
const oaHex=oaDigest();
test('Zalo OA documented formula synthetic digest matches exactly',()=>{
 assert.equal(verifyZaloOaSyntheticDigest({appId,exactDataBytes:rawOAData,timeStamp,oaSecret,digestHex:oaHex}),true);
});
const badOA=[
 ['mutated body',{exactDataBytes:Buffer.concat([rawOAData,Buffer.from(' ')])}],
 ['wrong app ID',{appId:'SYNTHETIC_OA_APP_124'}],
 ['changed timestamp',{timeStamp:'1794920000001'}],
 ['wrong OA secret',{oaSecret:oaSecret+'_X'}],
 ['non-buffer data',{exactDataBytes:rawOAData.toString()}],
 ['empty data',{exactDataBytes:Buffer.alloc(0)}],
 ['oversized data',{exactDataBytes:Buffer.alloc(65537)}],
 ['short app ID',{appId:'X'}],
 ['short secret',{oaSecret:'bad'}],
 ['missing timestamp',{timeStamp:undefined}],
 ['non-numeric timestamp',{timeStamp:'yesterday'}],
 ['uppercase digest',{digestHex:oaHex.toUpperCase()}],
 ['wrong digest',{digestHex:'1'.repeat(64)}],
 ['bad digest format',{digestHex:'mac='+oaHex}]
];
for(const [name,change] of badOA)test('Zalo OA synthetic rejects '+name,()=>{
 const x=verifyZaloOaSyntheticDigest({appId,exactDataBytes:rawOAData,timeStamp,oaSecret,digestHex:oaHex,...change});
 assert.equal(x,false);
});
const botSecret='SYNTHETIC_BOT_HEADER_SECRET_123456';
test('Zalo Bot secret-token header exact constant-time match',()=>assert.equal(verifyZaloBotSyntheticSecret({receivedHeader:botSecret,configuredSecret:botSecret}),true));
for(const [name,h,s] of [
 ['wrong header',botSecret+'x',botSecret],
 ['wrong secret',botSecret,botSecret+'x'],
 ['missing header',undefined,botSecret],
 ['short header','x',botSecret],
 ['short configured secret','somevalue','x'],
 ['empty values','',''],
 ['case changed',botSecret.toLowerCase(),botSecret],
 ['undefined secret',botSecret,undefined]
])test('Zalo Bot synthetic rejects '+name,()=>assert.equal(verifyZaloBotSyntheticSecret({receivedHeader:h,configuredSecret:s}),false));

for(const provider of ['meta-messenger','zalo-oa','zalo-bot']){
 test(provider+' without private proof always blocked',()=>{const x=inspectPrivateCanary({provider,mode:'NO_SEND_NO_WRITE'});assert.equal(x.status,'PRIVATE_CANARY_NO_GO');assert.equal(x.canOpenCanary,false)});
 test(provider+' self-attested complete proof still blocked',()=>{
  const x=inspectPrivateCanary({provider,mode:'NO_SEND_NO_WRITE',claims:Object.fromEntries(PRIVATE_CANARY_GATES.map(k=>[k,true]))});
  assert.equal(x.realProviderSignatureAccepted,false);assert.equal(x.canSend,false);assert.equal(x.canReadOrders,false);
 });
 for(const gate of PRIVATE_CANARY_GATES)test(provider+' missing gate '+gate,()=>{
  const claims=Object.fromEntries(PRIVATE_CANARY_GATES.map(k=>[k,true]));claims[gate]=false;
  const x=inspectPrivateCanary({provider,mode:'NO_SEND_NO_WRITE',claims});
  assert.ok(x.blockers.includes('MISSING_'+gate.toUpperCase()));
 });
}
for(const key of ['rawBody','signature','appSecret','oaSecret','botSecret','jwt','bearer','accessToken','refreshToken','userId','merchantId','storeId','orderId','senderId','customerPhone','providerHeader','originalEvent','secret','privateOwnerEvidence'])
 test('private raw '+key+' never accepted or echoed',()=>{
  const x=inspectPrivateCanary({provider:'zalo-bot',mode:'NO_SEND_NO_WRITE',[key]:'PRIVATE_DO_NOT_ECHO_999'});
  assert.ok(x.blockers.includes('RAW_OR_SENSITIVE_DATA_FORBIDDEN'));
  assert.equal(JSON.stringify(x).includes('PRIVATE_DO_NOT_ECHO_999'),false);
 });
test('wrong operation mode denies send',()=>{const x=inspectPrivateCanary({provider:'meta-messenger',mode:'SEND'});assert.ok(x.blockers.includes('MODE_NOT_NO_SEND_NO_WRITE'));assert.equal(x.canSend,false)});
test('unknown provider denied',()=>assert.ok(inspectPrivateCanary({provider:'TEST',mode:'NO_SEND_NO_WRITE'}).blockers.includes('UNSUPPORTED_PROVIDER')));
