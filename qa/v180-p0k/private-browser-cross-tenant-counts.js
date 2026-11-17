// TIEN404 V18.0-P0K — REAL browser-session RLS negative acceptance, source-only.
// Operator: review this ENTIRE script, then paste into DevTools Console on
// https://tien404-auth-staging.onrender.com/account.html for EACH authorized
// independently authenticated QA browser profile, once per Owner, with consent.
// NO token/JWT/email/tenant id/request body leaves the local output.
// Only Supabase official getUser/getClaims and head:true COUNT-only SELECTs.
// This is browser-local evidence only, not independent server acceptance.
(async () => {
 'use strict';
 const TAG='TIEN404_P0K_LOCAL';
 const EXPECTED_ORIGIN='https://tien404-auth-staging.onrender.com';
 const ISSUER='https://ifxlvrhyjhbzbrkdsida.supabase.co/auth/v1';
 const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 const TABLES=['products','orders','order_items','customers','conversations','messages'];
 const STOP = reason => console.info(TAG, {
  status:'BLOCKED', reason, localRlsCheckPassed:false,
  serverRevocationVerified:false,realStoreAuthorityVerified:false,
  canSend:false,canMigrate:false,canPublish:false
 });
 try{
  if(location.origin!==EXPECTED_ORIGIN || location.pathname!=='/account.html')
   return STOP('WRONG_ORIGIN_OR_PAGE');
  if(!confirm('Chỉ chạy thử nghiệm COUNT-only RLS Tenant cho tài khoản QA này? Không xem nội dung đơn/khách, không ghi dữ liệu, không gửi tin.'))
   return STOP('OPERATOR_CONSENT_NOT_GIVEN');
  const {getAuthClient}=await import('/assets/auth-client.js');
  const client=await getAuthClient();
  const userRes=await client.auth.getUser();
  const uid=userRes?.data?.user?.id;
  if(userRes?.error||!UUID.test(uid||'')||userRes?.data?.user?.is_anonymous===true)
   return STOP('AUTH_GETUSER_FAILED');
  const claimsRes=await client.auth.getClaims();
  const c=claimsRes?.data?.claims;
  const now=Math.floor(Date.now()/1000);
  const audience=c?.aud==='authenticated'||(Array.isArray(c?.aud)&&c.aud.includes('authenticated'));
  if(claimsRes?.error||!c||c.iss!==ISSUER||!audience||
     c.role!=='authenticated'||c.sub!==uid||!UUID.test(c.session_id||'')||
     !Number.isFinite(c.exp)||c.exp<=now||!Number.isFinite(c.iat)||c.iat>now+60)
    return STOP('AUTH_GETCLAIMS_FAILED');
  const members=await client.from('tenant_memberships')
    .select('tenant_id,role,active')
    .eq('user_id',uid).eq('active',true).limit(3);
  if(members.error||!Array.isArray(members.data)||members.data.length!==1||
     members.data[0].role!=='owner'||members.data[0].active!==true||
     !UUID.test(members.data[0].tenant_id||''))
    return STOP('OWNER_TENANT_SCOPE_AMBIGUOUS_OR_UNVERIFIED');
  const ownTenant=members.data[0].tenant_id; // stays inside this browser
  // A positive baseline is necessary: independent staging audit found
  // 1 QA product and 1 QA order in EACH of the two authorized QA tenants.
  for(const table of ['products','orders']){
    const r=await client.from(table).select('id',{count:'exact',head:true})
      .eq('tenant_id',ownTenant);
    if(r.error||!Number.isSafeInteger(r.count)||r.count<1)
      return STOP('OWN_TENANT_BASELINE_UNAVAILABLE_'+table.toUpperCase());
  }
  // Count-only SELECT of any OTHER tenant, never requests row contents.
  // A positive count here indicates serious cross-tenant RLS failure.
  for(const table of TABLES){
    const r=await client.from(table).select('id',{count:'exact',head:true})
      .neq('tenant_id',ownTenant);
    if(r.error||!Number.isSafeInteger(r.count))
      return STOP('NEGATIVE_RLS_QUERY_UNAVAILABLE_'+table.toUpperCase());
    if(r.count!==0)return STOP('POTENTIAL_CROSS_TENANT_VISIBILITY_'+table.toUpperCase());
  }
  // Direct negative membership scope: even same-Tenant co-owner rows
  // must not leak to an unrelated caller through this self-only policy.
  const others=await client.from('tenant_memberships')
    .select('tenant_id',{count:'exact',head:true}).neq('user_id',uid);
  if(others.error||!Number.isSafeInteger(others.count)||others.count!==0)
    return STOP('MEMBERSHIP_SELF_SCOPE_UNVERIFIED');
  const final=await client.auth.getUser();
  if(final.error||final.data?.user?.id!==uid)
    return STOP('AUTH_SUBJECT_CHANGED_DURING_TEST');
  // Public-safe output only: NEVER print raw requests, Auth user, JWT,
  // tenant UUID, row IDs, order content, email or response errors.
  console.info(TAG, {
    status:'LOCAL_TENANT_RLS_NEGATIVE_OBSERVED',
    ownProductsAndOrdersVisible:true,
    otherTenantRowsVisible:false,
    negativeCommerceTablesChecked:TABLES.length,
    otherMembershipRowsVisible:false,
    signedClaimsCheckedLocally:true,
    independentServerSessionRevocationVerified:false,
    canonicalSameTenantStoreAbVerified:false,
    actualProviderSends:0, actualCommerceWrites:0,
    canReadRealCustomerOrders:false,canSend:false,canMigrate:false,
    canPromoteCore:false
  });
 }catch{
  STOP('AUTH_CLIENT_OR_NETWORK_UNAVAILABLE');
 }
})();
