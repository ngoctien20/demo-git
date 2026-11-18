// TIEN404 V18.0-P0L — QA-only Auth Evidence, SOURCE CANDIDATE.
// Browser-local read-only; no Store grant, session revocation assertion, DB write, or provider send.
const EXPECTED_ISSUER='https://ifxlvrhyjhbzbrkdsida.supabase.co/auth/v1';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const validNonce = value => typeof value==='string' && UUID.test(value);
const deny = code => Object.freeze({
  status:'BLOCKED', reason:code, localAuthChecked:false,
  ownerTenantCodes:[],actorCode:null,
  realServerSessionVerified:false, canonicalStoreOwnerVerified:false,
  canGrantRoles:false,canMigrate:false,canPublish:false,canSend:false
});
export async function verifyOwnerLocally({
 client, nonce, consent, cryptoApi=globalThis.crypto,
 clock=()=>Math.floor(Date.now()/1000)
}={}){
 if(consent!==true)return deny('OPERATOR_CONSENT_REQUIRED');
 if(!validNonce(nonce))return deny('ONE_TIME_CODE_REQUIRED');
 if(!cryptoApi?.subtle || typeof cryptoApi.subtle.sign!=='function')
   return deny('SECURE_CRYPTO_UNAVAILABLE');
 if(!client?.auth || typeof client.auth.getUser!=='function' ||
    typeof client.auth.getClaims!=='function' ||
    typeof client.from!=='function')return deny('OFFICIAL_AUTH_CLIENT_REQUIRED');
 try{
   const userResult=await client.auth.getUser();
   const subject=userResult?.data?.user?.id;
   if(userResult?.error || !UUID.test(subject||'') ||
      userResult?.data?.user?.is_anonymous===true)
     return deny('GETUSER_NOT_VERIFIED');
   const claimsResult=await client.auth.getClaims();
   const claims=claimsResult?.data?.claims;
   const now=clock();
   const aud=claims?.aud;
   const audOk=aud==='authenticated' || (Array.isArray(aud)&&aud.includes('authenticated'));
   if(claimsResult?.error || !claims || claims.sub!==subject ||
      claims.iss!==EXPECTED_ISSUER || !audOk || claims.role!=='authenticated' ||
      !UUID.test(claims.session_id||'') ||
      !Number.isFinite(claims.exp) || claims.exp<=now ||
      !Number.isFinite(claims.iat) || claims.iat>now+60)
      return deny('GETCLAIMS_NOT_VERIFIED');
   const {data, error}=await client.from('tenant_memberships')
     .select('tenant_id,role,active').eq('user_id',subject).eq('active',true).limit(25);
   if(error || !Array.isArray(data) || data.length>=25)
      return deny('OWNER_RLS_SCOPE_UNAVAILABLE');
   const tenantIds=[...new Set(data.filter(row=>
      row?.active===true && row?.role==='owner' && UUID.test(row?.tenant_id||''))
      .map(row=>row.tenant_id.toLowerCase()))];
   if(!tenantIds.length)return deny('ACTIVE_OWNER_MEMBERSHIP_NOT_PRESENT');
   const encoder=new TextEncoder();
   const key=await cryptoApi.subtle.importKey('raw',encoder.encode(nonce),
     {name:'HMAC',hash:'SHA-256'},false,['sign']);
   const hmac=async str=>{
     const result=await cryptoApi.subtle.sign('HMAC',key,encoder.encode(str));
     return Array.from(new Uint8Array(result).slice(0,20))
       .map(x=>x.toString(16).padStart(2,'0')).join('');
   };
   const actorCode=await hmac('TIEN404-P0L-ACTOR:'+subject.toLowerCase());
   const ownerTenantCodes=(await Promise.all(tenantIds
     .map(id=>hmac('TIEN404-P0L-OWNER-TENANT:'+id)))).sort();
   return Object.freeze({
     status:'LOCAL_OWNER_AUTH_READ_OK',reason:'INDEPENDENT_SERVER_EVIDENCE_REQUIRED',
     localAuthChecked:true,actorCode,ownerTenantCodes:Object.freeze(ownerTenantCodes),
     realServerSessionVerified:false,canonicalStoreOwnerVerified:false,
     canGrantRoles:false,canMigrate:false,canPublish:false,canSend:false
   });
 }catch{
   // Never log Auth error objects. They could contain tokens or personal data.
   return deny('AUTH_OR_NETWORK_CHECK_FAILED');
 }
}
export function compareTwoLocalReports(a,b){
 const ok=a?.status==='LOCAL_OWNER_AUTH_READ_OK' &&
   b?.status==='LOCAL_OWNER_AUTH_READ_OK' &&
   typeof a.actorCode==='string' && typeof b.actorCode==='string' &&
   a.actorCode!==b.actorCode &&
   Array.isArray(a.ownerTenantCodes) && Array.isArray(b.ownerTenantCodes) &&
   a.ownerTenantCodes.some(x=>b.ownerTenantCodes.includes(x));
 return Object.freeze({
   localBrowserIndication:ok?'TWO_DIFFERENT_ACTORS_COMMON_TENANT_OWNER':'NOT_ESTABLISHED',
   serverSignedProof:false,storeAuthorityVerified:false,
   canMigrate:false,canSend:false,canPublish:false
 });
}
