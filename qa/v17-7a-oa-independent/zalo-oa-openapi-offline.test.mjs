import test from 'node:test';
import assert from 'node:assert/strict';
import {
 describeZaloOaApiContract,inspectSyntheticGetOaResponse,
 inspectOfflineTokenRotation,inspectSyntheticOaError
} from './zalo-oa-openapi-offline.mjs';

const NOW=1794912000000;
const oaId='388613280878808645';
function lease(){return {
  tokenExchangeType:'refresh_token',oldRefreshVersion:7,newRefreshVersion:8,
  oneTimeRefreshReserved:true,atomicVaultCasCommitted:true,
  previousAccessTokenRevoked:true,
  oldAccessExpiryMs:NOW+3600000,newAccessExpiryMs:NOW+25*3600*1000,
  newRefreshExpiryMs:NOW+90*24*3600*1000,
  noSend:true,noCommerceWrite:true
};}
const clock={mode:'OFFLINE_FIXTURE_ONLY',nowMs:NOW};
function noGo(r){assert.equal(r.realOaAuthorized,false);
  assert.equal(r.realProviderCallMade,false);
  assert.equal(r.canSend,false);assert.equal(r.canWriteOrders,false);
  assert.equal(r.canPublish,false);}
test('documented GET OA is a read-only description, never network call',()=>{
 const r=describeZaloOaApiContract('GET_OA');
 assert.equal(r.candidate,true);assert.equal(r.method,'GET');
 assert.equal(r.url,'https://openapi.zalo.me/v2.0/oa/getoa');
 assert.deepEqual(r.requiredHeaders,['access_token']);
 assert.equal(r.networkPermitted,false);noGo(r);
});
test('OAuth code contract uses official token host and form PKCE',()=>{
 const r=describeZaloOaApiContract('OAUTH_CODE');
 assert.equal(r.url,'https://oauth.zaloapp.com/v4/oa/access_token');
 assert.equal(r.method,'POST');assert.ok(r.requiredForm.includes('code_verifier'));
 assert.deepEqual(r.requiredHeaders,['secret_key']);noGo(r);
});
test('OAuth refresh contract is the same token URL with grant_type refresh_token',()=>{
 const r=describeZaloOaApiContract('OAUTH_REFRESH');
 assert.ok(r.requiredForm.includes('grant_type=refresh_token'));noGo(r);
});
test('sending endpoint is cataloged but always forbidden',()=>{
 const r=describeZaloOaApiContract('CS_SEND');
 assert.equal(r.url,'https://openapi.zalo.me/v3.0/oa/message/cs');
 assert.equal(r.method,'POST');assert.equal(r.networkPermitted,false);
 assert.equal(r.sideEffect,'PROVIDER_MESSAGE_SEND_PROHIBITED');noGo(r);
});
test('unknown/legacy API operation rejected',()=>{
 const r=describeZaloOaApiContract('LEGACY_MESSAGE_V2');
 assert.equal(r.candidate,false);noGo(r);
});
test('matching getoa synthetic response shape is not real ownership',()=>{
 const r=inspectSyntheticGetOaResponse({error:0,data:{oaid:oaId,name:'QA Store OA'}},
   {executionMode:'OFFLINE_FIXTURE_ONLY',liveEnabled:false,pinnedOaId:oaId});
 assert.equal(r.candidate,true);assert.equal(r.realProfileReadbackVerified,false);noGo(r);
});
test('getoa without pinned owner OA rejected',()=>{
 const r=inspectSyntheticGetOaResponse({error:0,data:{oaid:oaId,name:'QA'}},
  {executionMode:'OFFLINE_FIXTURE_ONLY',liveEnabled:false,pinnedOaId:'other'});
 assert.equal(r.candidate,false);noGo(r);
});
test('getoa with wrong OA is denied despite API success',()=>{
 const r=inspectSyntheticGetOaResponse({error:0,data:{oaid:'12345678900',name:'Other'}},
  {executionMode:'OFFLINE_FIXTURE_ONLY',liveEnabled:false,pinnedOaId:oaId});
 assert.equal(r.candidate,false);assert.equal(r.reason,'OA_PROFILE_READBACK_MISMATCH');noGo(r);
});
test('getoa error -223 is never mistaken for success',()=>{
 const r=inspectSyntheticGetOaResponse({error:-223,data:{oaid:oaId,name:'QA'}},
  {executionMode:'OFFLINE_FIXTURE_ONLY',liveEnabled:false,pinnedOaId:oaId});
 assert.equal(r.candidate,false);noGo(r);
});
test('getoa missing name denied',()=>{
 const r=inspectSyntheticGetOaResponse({error:0,data:{oaid:oaId}},
  {executionMode:'OFFLINE_FIXTURE_ONLY',liveEnabled:false,pinnedOaId:oaId});
 assert.equal(r.candidate,false);noGo(r);
});
test('getoa cannot run with live enabled',()=>{
 const r=inspectSyntheticGetOaResponse({error:0,data:{oaid:oaId,name:'QA'}},
  {executionMode:'OFFLINE_FIXTURE_ONLY',liveEnabled:true,pinnedOaId:oaId});
 assert.equal(r.candidate,false);noGo(r);
});
test('single-use refresh policy metadata has no vault or provider proof',()=>{
 const r=inspectOfflineTokenRotation(lease(),clock);
 assert.equal(r.candidate,true);assert.equal(r.canUseToken,false);
 assert.equal(r.vaultCommittedInRealWorld,false);noGo(r);
});
function rejectLease(reason,fn){
 const l=lease();fn(l);const r=inspectOfflineTokenRotation(l,clock);
 assert.equal(r.candidate,false);assert.equal(r.reason,reason);noGo(r);
}
test('reused refresh version blocked',()=>rejectLease('TOKEN_REFRESH_VERSION_NOT_MONOTONIC',l=>l.newRefreshVersion=7));
test('skipped refresh version blocked',()=>rejectLease('TOKEN_REFRESH_VERSION_NOT_MONOTONIC',l=>l.newRefreshVersion=9));
test('refresh reservation missing blocked',()=>rejectLease('ONE_TIME_REFRESH_OR_VAULT_CAS_NOT_PROVEN',l=>l.oneTimeRefreshReserved=false));
test('CAS vault update failed blocked',()=>rejectLease('ONE_TIME_REFRESH_OR_VAULT_CAS_NOT_PROVEN',l=>l.atomicVaultCasCommitted=false));
test('old access token remains active blocked',()=>rejectLease('ONE_TIME_REFRESH_OR_VAULT_CAS_NOT_PROVEN',l=>l.previousAccessTokenRevoked=false));
test('expired new access token blocked',()=>rejectLease('TOKEN_LEASE_TIME_INVALID',l=>l.newAccessExpiryMs=NOW-1));
test('unusually long access lease blocked',()=>rejectLease('TOKEN_LEASE_TIME_INVALID',l=>l.newAccessExpiryMs=NOW+48*3600*1000));
test('refresh expiry shorter than access rejected',()=>rejectLease('TOKEN_LEASE_TIME_INVALID',l=>l.newRefreshExpiryMs=NOW+10000));
test('refresh expiry unreasonably far rejected',()=>rejectLease('TOKEN_LEASE_TIME_INVALID',l=>l.newRefreshExpiryMs=NOW+120*24*3600*1000));
test('write-enabled lease rejected',()=>rejectLease('TRUSTED_TOKEN_ROTATION_FIXTURE_MISSING',l=>l.noCommerceWrite=false));
test('send-enabled lease rejected',()=>rejectLease('TRUSTED_TOKEN_ROTATION_FIXTURE_MISSING',l=>l.noSend=false));
test('OA permission -223 denies retry and sends',()=>{
 const r=inspectSyntheticOaError(-223);
 assert.equal(r.reason,'OA_API_PERMISSION_NOT_GRANTED');assert.equal(r.retryAllowed,false);noGo(r);
});
test('OA token invalid -124 denies blind retry',()=>{
 const r=inspectSyntheticOaError(-124);
 assert.equal(r.reason,'OA_ACCESS_TOKEN_INVALID');assert.equal(r.retryAllowed,false);noGo(r);
});
test('message V2 disabled -240 cannot be called',()=>{
 const r=inspectSyntheticOaError(-240);
 assert.equal(r.reason,'LEGACY_MESSAGE_V2_API_DISABLED');noGo(r);
});
test('error=0 only synthetic success, not a real provider call',()=>{
 const r=inspectSyntheticOaError(0);
 assert.equal(r.candidate,true);noGo(r);
});
test('unknown error fails closed',()=>{
 const r=inspectSyntheticOaError(-99999);
 assert.equal(r.candidate,false);noGo(r);
});
test('string error cannot be converted into success',()=>{
 const r=inspectSyntheticOaError('0');
 assert.equal(r.candidate,false);noGo(r);
});
