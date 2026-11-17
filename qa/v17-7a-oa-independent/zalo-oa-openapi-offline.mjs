// TIEN404 V17.7A — Zalo OA OpenAPI offline contract gate.
// Official docs: https://stc-developers.zdn.vn/docs/v2/official-account/
// No fetch/HTTP client, access tokens, OAuth exchanges, provider sends,
// real provider signatures, credential reads or Commerce writes in this module.

const OA_API='https://openapi.zalo.me';
const OAUTH='https://oauth.zaloapp.com';
const outcome=(reason,extra={})=>Object.freeze({
  candidate:false,reason,sourceOnly:true,
  realOaAuthorized:false,realProviderCallMade:false,
  canSend:false,canWriteOrders:false,canPublish:false,...extra
});
const ok=(reason,extra={})=>Object.freeze({
  candidate:true,reason,sourceOnly:true,
  realOaAuthorized:false,realProviderCallMade:false,
  canSend:false,canWriteOrders:false,canPublish:false,...extra
});
const OAID=/^[0-9]{5,25}$/;

/** Descriptive route contract ONLY; never accepts or emits credentials.
 * No OA API is invoked. CS messaging always forbidden in QA.
 */
export function describeZaloOaApiContract(name){
  const routes={
    GET_OA:{method:'GET',url:OA_API+'/v2.0/oa/getoa',
      requiredHeaders:['access_token'],requiredScope:'OA_INFO_MANAGEMENT'},
    OAUTH_CODE:{method:'POST',url:OAUTH+'/v4/oa/access_token',
      contentType:'application/x-www-form-urlencoded',
      requiredHeaders:['secret_key'],
      requiredForm:['grant_type=authorization_code','code','app_id','code_verifier']},
    OAUTH_REFRESH:{method:'POST',url:OAUTH+'/v4/oa/access_token',
      contentType:'application/x-www-form-urlencoded',
      requiredHeaders:['secret_key'],
      requiredForm:['grant_type=refresh_token','refresh_token','app_id']},
    CS_SEND:{method:'POST',url:OA_API+'/v3.0/oa/message/cs',
      contentType:'application/json',requiredHeaders:['access_token'],
      requiredScope:'OA_SEND_MESSAGE',
      sideEffect:'PROVIDER_MESSAGE_SEND_PROHIBITED'}
  };
  if(!Object.hasOwn(routes,name))return outcome('UNSUPPORTED_ZALO_API_OPERATION');
  return ok(name==='CS_SEND'?'SEND_ENDPOINT_IS_DESCRIPTIVE_ONLY':'DOCUMENTED_ENDPOINT_SHAPE_ONLY',{
    operation:name,...routes[name],networkPermitted:false,
    requestConstructed:false,tokenEverAccessed:false
  });
}

/** Validates a synthetic API response shape only; an OA ID string may not
 * be used as authorization evidence until a private, authenticated provider
 * request verifies it. Never echo OA details or raw server response.
 */
export function inspectSyntheticGetOaResponse(response,expected){
  if(!expected||expected.executionMode!=='OFFLINE_FIXTURE_ONLY'||
    expected.liveEnabled!==false||!OAID.test(expected.pinnedOaId??''))
    return outcome('TRUSTED_QA_EXPECTATION_MISSING');
  if(!response||typeof response!=='object'||Array.isArray(response))
    return outcome('MALFORMED_PROVIDER_RESPONSE');
  if(response.error!==0)return outcome('PROVIDER_RETURNED_ERROR_OR_UNAUTHORIZED');
  if(!response.data||typeof response.data!=='object'||
     response.data.oaid!==expected.pinnedOaId)
    return outcome('OA_PROFILE_READBACK_MISMATCH');
  if(typeof response.data.name!=='string'||!response.data.name.trim())
    return outcome('OA_PROFILE_NAME_MISSING');
  return ok('SYNTHETIC_GETOA_PROFILE_SHAPE_MATCHES',{
    oaProfileShapeMatched:true,realProfileReadbackVerified:false
  });
}

/** Input contains only expiration/version metadata, no OAuth secrets.
 * CAS + one-time refresh behavior is REQUIRED but this evaluator cannot
 * prove a hosted DB/vault was updated by an independent verifier.
 */
export function inspectOfflineTokenRotation(metadata,clock){
  if(!metadata||!clock||clock.mode!=='OFFLINE_FIXTURE_ONLY'||
     !Number.isSafeInteger(clock.nowMs)||clock.nowMs<=0||
     metadata.noSend!==true||metadata.noCommerceWrite!==true)
    return outcome('TRUSTED_TOKEN_ROTATION_FIXTURE_MISSING');
  const {oldRefreshVersion,newRefreshVersion,tokenExchangeType,
    oneTimeRefreshReserved,atomicVaultCasCommitted,
    previousAccessTokenRevoked,
    oldAccessExpiryMs,newAccessExpiryMs,
    newRefreshExpiryMs}=metadata;
  if(tokenExchangeType!=='refresh_token'||!Number.isSafeInteger(oldRefreshVersion)||
     oldRefreshVersion<0||newRefreshVersion!==oldRefreshVersion+1)
    return outcome('TOKEN_REFRESH_VERSION_NOT_MONOTONIC');
  if(oneTimeRefreshReserved!==true||atomicVaultCasCommitted!==true||
     previousAccessTokenRevoked!==true)
    return outcome('ONE_TIME_REFRESH_OR_VAULT_CAS_NOT_PROVEN');
  if(!Number.isSafeInteger(oldAccessExpiryMs)||
     !Number.isSafeInteger(newAccessExpiryMs)||
     !Number.isSafeInteger(newRefreshExpiryMs)||
     newAccessExpiryMs<=clock.nowMs||
     newRefreshExpiryMs<=newAccessExpiryMs||
     newAccessExpiryMs<=oldAccessExpiryMs||
     newAccessExpiryMs>clock.nowMs+25*3600*1000+60000||
     newRefreshExpiryMs>clock.nowMs+93*24*3600*1000)
    return outcome('TOKEN_LEASE_TIME_INVALID');
  return ok('SYNTHETIC_ONE_TIME_REFRESH_POLICY_SHAPE_PASS',{
    canUseToken:false,vaultCommittedInRealWorld:false
  });
}

/** Zalo error codes are provider-defined and transport HTTP 200 does not
 * mean success. Always require error === 0; do not retry authorization
 * errors. Codes below are documented in official OA error appendix.
 */
export function inspectSyntheticOaError(code){
  if(!Number.isSafeInteger(code))return outcome('INVALID_PROVIDER_ERROR_CODE');
  if(code===0)return ok('SYNTHETIC_PROVIDER_SUCCESS_SHAPE_ONLY');
  if(code===-223)return outcome('OA_API_PERMISSION_NOT_GRANTED',{retryAllowed:false});
  if(code===-124)return outcome('OA_ACCESS_TOKEN_INVALID',{retryAllowed:false});
  if(code===-240)return outcome('LEGACY_MESSAGE_V2_API_DISABLED',{retryAllowed:false});
  return outcome('OA_API_ERROR_FAIL_CLOSED',{retryAllowed:false});
}
