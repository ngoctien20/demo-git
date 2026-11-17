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



// P0O browser-local receipt. The value is USER-COPYABLE and UNTRUSTED,
// never a backend-signed proof. Includes only HMAC pseudonyms + one-time nonce.
const HEX40=/^[0-9a-f]{40}$/;
const RECEIPT_DOMAIN='TIEN404_PRIVATE_AUTH_QA_P0O';
const MAX_AGE_SECONDS=30*60;
const validCode=code=>typeof code==='string' && HEX40.test(code);
export function makeLocalPairReceipt(evidence,nonce,at=Math.floor(Date.now()/1000)){
 if(!validNonce(nonce)||evidence?.status!=='LOCAL_OWNER_AUTH_READ_OK'||
   !validCode(evidence.actorCode) ||
   !Array.isArray(evidence.ownerTenantCodes) ||
   evidence.ownerTenantCodes.length<1 || evidence.ownerTenantCodes.length>10 ||
   evidence.ownerTenantCodes.some(c=>!validCode(c))||
   !Number.isSafeInteger(at)||at<=0) return null;
 return JSON.stringify({
   domain:RECEIPT_DOMAIN,version:1,
   nonce,actor:evidence.actorCode,owners:[...new Set(evidence.ownerTenantCodes)].sort(),
   issuedAt:at
 });
}
const rejectCompare=reason=>Object.freeze({
 status:'BLOCKED',reason,
 differentActor:false,sameTenantOwner:false,
 serverSignedProof:false,sessionRevocationVerified:false,
 canonicalStoreAuthority:false,canSend:false,canMigrate:false
});
export function comparePeerLocalReceipt(localEvidence,nonce,raw,at=Math.floor(Date.now()/1000)){
 if(localEvidence?.status!=='LOCAL_OWNER_AUTH_READ_OK' ||
   !validCode(localEvidence.actorCode) ||
   !Array.isArray(localEvidence.ownerTenantCodes) ||
   !validNonce(nonce)) return rejectCompare('LOCAL_ACCOUNT_NOT_CHECKED');
 if(typeof raw!=='string'||raw.length<50||raw.length>1800)
   return rejectCompare('PEER_RECEIPT_MISSING_OR_TOO_LONG');
 let peer;
 try{peer=JSON.parse(raw);}catch{return rejectCompare('INVALID_RECEIPT_JSON');}
 if(!peer||typeof peer!=='object'||Array.isArray(peer) ||
   Object.keys(peer).sort().join(',')!=='actor,domain,issuedAt,nonce,owners,version'||
   peer.domain!==RECEIPT_DOMAIN||peer.version!==1 ||
   peer.nonce!==nonce||!validCode(peer.actor) ||
   !Array.isArray(peer.owners)||peer.owners.length<1||peer.owners.length>10 ||
   peer.owners.some(c=>!validCode(c)) ||
   !Number.isSafeInteger(peer.issuedAt)|| !Number.isSafeInteger(at))
   return rejectCompare('MISMATCH_OR_MALFORMED_RECEIPT');
 if(peer.issuedAt>at+120||at-peer.issuedAt>MAX_AGE_SECONDS)
   return rejectCompare('RECEIPT_EXPIRED');
 if(localEvidence.actorCode===peer.actor)
   return rejectCompare('SAME_ACTOR_FINGERPRINT');
 if(!localEvidence.ownerTenantCodes.some(c=>peer.owners.includes(c)))
   return rejectCompare('NO_COMMON_OWNER_TENANT');
 return Object.freeze({
   status:'LOCAL_TWO_ACTOR_SAME_OWNER_TENANT_INDICATION',
   reason:'UNSIGNED_BROWSER_ONLY_NOT_SERVER_OR_STORE_PROOF',
   differentActor:true,sameTenantOwner:true,
   serverSignedProof:false,sessionRevocationVerified:false,
   canonicalStoreAuthority:false,canSend:false,canMigrate:false
 });
}
