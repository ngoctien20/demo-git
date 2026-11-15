'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {generateKeyPairSync,sign,createHash}=require('node:crypto');
const {assessG23,verifiedRoots,ROLES}=require('./g23-independent-owner-consent-gate.cjs');
const now=Date.UTC(2026,10,15,20,51,0);
const digest=s=>createHash('sha256').update('SYNTHETIC_G23_FIXTURE_ONLY:'+s).digest('hex');
const common={challenge_nonce:'a'.repeat(64),tenant_digest:digest('tenantB'),store_digest:digest('storeB'),bot_digest:digest('botB'),subject_digest:digest('subjectB')};
const pairs=Object.fromEntries(Object.keys(ROLES).map(r=>[r,generateKeyPairSync('ec',{namedCurve:'prime256v1'})]));
const roots=Object.fromEntries(Object.keys(ROLES).map(r=>[ROLES[r],pairs[r].publicKey.export({format:'pem',type:'spki'})]));
const base={
 zalo_user:{...common,provider:'zalo_social_oauth',authentication_method:'ZALO_OAUTH2_PKCE_SERVER_TOKEN_EXCHANGE',authenticated_user_observed:true,account_linkage_verified:true,zalo_subject_linked_to_supabase_user:true,oauth_state_and_pkce_checked:true,zalo_user_digest:digest('zalo-account-qa'),auth_time_ms:now-1000},
 bot_manager:{...common,source:'INDEPENDENT_BOT_CREATOR_CONTROL_REVIEW',bot_creator_authenticated_session_verified:true,provider_control_challenge_verified:true,review_operator_distinct_from_owner:true,bot_manager_control_verified:true,checked_ms:now-1000},
 supabase_owner:{...common,source:'SUPABASE_AUTH_TRUSTED_SERVER',jwt_validated_server_side:true,membership_tenant_pinned:true,membership_role:'owner',membership_active:true,query_readonly:true,owner_membership_unique_for_subject:true,checked_ms:now-1000},
 merchant_consent:{...common,source:'AUTHENTICATED_MERCHANT_DASHBOARD',consent_explicit:true,consent_revoked:false,consent_scope:'G23_BOT_SHOP_B_QA_IDENTITY_ONLY_NO_SEND',terms_version:'G23-V1-NO-SEND',user_gesture_verified:true,consent_ms:now-1000,consent_expires_ms:now+86400000,owner_allowlist_verified:true,owner_allowlist_exp_ms:now+180000}
};
function signed(role,c=base[role],signedBy=role){
 const payload=JSON.stringify({issuer:ROLES[role],purpose:'TIEN404_G23_OWNER_EVIDENCE_PRIVATE_REVIEW_ONLY',issued_ms:now-1000,expires_ms:now+119000,claims:c});
 return {payload,signature:sign('sha256',Buffer.from(payload),{key:pairs[signedBy].privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url')};
}
function evidence(patches={}){return {evidence:Object.fromEntries(Object.keys(ROLES).map(role=>[role,signed(role,{...base[role],...(patches[role]||{})})]))};}
function server(patch={}){
 const used=new Set();
 return {pinnedIssuerKeys:roots,storeScope:'QA_SHOP_B_ONLY',tenantDigest:common.tenant_digest,storeDigest:common.store_digest,botDigest:common.bot_digest,
   verifyG22CandidateReadOnly:async()=>true,
   consumeOnce:async({nonce,ttlMs,scope})=>{if(scope!=='G23_OWNER_QA_PRIVATE_REVIEW'||ttlMs!==120000||used.has(nonce))return false;used.add(nonce);return true},...patch};
}
async function denied(patches,reason,opts=server()){
 const r=await assessG23(evidence(patches),opts,now);
 assert.equal(r.status,'BLOCKED',JSON.stringify(r));
 assert.ok(r.blocked_reasons.includes(reason),JSON.stringify(r));
 assert.equal(r.can_send,false);assert.equal(r.owner_permission_changed,false);assert.equal(r.live_registry_promoted,false);
}
test('four distinct P256 trust roots are required',()=>assert.equal(verifiedRoots(roots),true));
test('synthetic all-signed proof is only eligible for private review and cannot grant owner rights',async()=>{
 const r=await assessG23(evidence(),server(),now);
 assert.equal(r.status,'ELIGIBLE_FOR_PRIVATE_HUMAN_REVIEW_ONLY');
 assert.equal(r.signed_sources_verified,4);
 assert.equal(r.private_owner_certified,false);
 assert.equal(r.merchant_authority_certified,false);
 assert.equal(r.live_registry_promoted,false);
 assert.equal(r.can_send,false);assert.equal(r.provider_sends,0);assert.equal(r.orders_written,0);
 assert.equal(r.owner_permission_changed,false);
 assert.equal(r.real_zalo_approved,false);
 assert.equal(r.challenge_consumed,true);
 assert.ok(!JSON.stringify(r).includes('zalo-account-qa'));
});
test('real hosted data lacks four signing roots and fails closed',async()=>{
 const r=await assessG23(evidence(),{},now);
 assert.ok(r.blocked_reasons.includes('HOSTED_TRUST_ROOTS_OR_ATOMIC_NONCE_STORE_NOT_CONFIGURED'));
});
test('user-provided roots are ignored',async()=>{
 const i=evidence();i.pinnedIssuerKeys=roots;
 const r=await assessG23(i,{},now);assert.equal(r.status,'BLOCKED');
});
test('duplicate signing keys for two issuers rejected',async()=>{
 const x=server({pinnedIssuerKeys:{...roots,[ROLES.merchant_consent]:roots[ROLES.zalo_user]}});
 assert.equal((await assessG23(evidence(),x,now)).status,'BLOCKED');
});
test('no atomic durable store blocks',async()=>assert.equal((await assessG23(evidence(),server({consumeOnce:null}),now)).status,'BLOCKED'));
test('invalid clock fail closed',async()=>assert.ok((await assessG23(evidence(),server(),-1)).blocked_reasons.includes('INVALID_TRUSTED_TIME')));
for(const role of Object.keys(ROLES)){
 test('missing '+role+' signed source blocks',async()=>{
  const i=evidence();delete i.evidence[role];
  const r=await assessG23(i,server(),now);
  assert.ok(r.blocked_reasons.includes('MISSING_OR_INVALID_'+role.toUpperCase()+'_SIGNED_PROOF'));
 });
 test('wrong issuer signer '+role+' blocks',async()=>{
  const i=evidence();const other=Object.keys(ROLES).find(k=>k!==role);
  i.evidence[role]=signed(role,base[role],other);
  const r=await assessG23(i,server(),now);
  assert.equal(r.status,'BLOCKED');
 });
}
test('one proof from different Bot cannot match server-pinned Bot',async()=>denied({zalo_user:{bot_digest:digest('botX')}},'CROSS_ISSUER_BOT_DIGEST_MISMATCH'));
test('one proof from another tenant cannot match Shop B',async()=>denied({supabase_owner:{tenant_digest:digest('tenantA')}},'CROSS_ISSUER_TENANT_DIGEST_MISMATCH'));
test('one proof from another store cannot match Shop B',async()=>denied({bot_manager:{store_digest:digest('storeA')}},'CROSS_ISSUER_STORE_DIGEST_MISMATCH'));
test('different Supabase authenticated subject cannot match Zalo identity',async()=>denied({merchant_consent:{subject_digest:digest('subjectA')}},'CROSS_ISSUER_SUBJECT_DIGEST_MISMATCH'));
test('challenge mismatch blocks',async()=>denied({bot_manager:{challenge_nonce:'b'.repeat(64)}},'INDEPENDENT_CHALLENGE_NOT_BOUND'));
test('server-pinned Shop B mismatch blocks',async()=>denied({},'SERVER_PINNED_SHOP_B_BOT_MISMATCH',server({tenantDigest:digest('tenantA')})));
test('OAuth not actually performed blocks',async()=>denied({zalo_user:{authenticated_user_observed:false}},'ZALO_OAUTH_OR_ACCOUNT_LINKAGE_NOT_VERIFIED'));
test('OAuth state PKCE not validated blocks',async()=>denied({zalo_user:{oauth_state_and_pkce_checked:false}},'ZALO_OAUTH_OR_ACCOUNT_LINKAGE_NOT_VERIFIED'));
test('Zalo OAuth identity not linked to Supabase subject blocks',async()=>denied({zalo_user:{account_linkage_verified:false}},'ZALO_OAUTH_OR_ACCOUNT_LINKAGE_NOT_VERIFIED'));
test('Zalo OAuth user cannot be assumed Bot Creator admin',async()=>denied({bot_manager:{bot_creator_authenticated_session_verified:false}},'INDEPENDENT_BOT_MANAGER_CONTROL_NOT_ATTESTED'));
test('Bot creator screenshot alone not control challenge',async()=>denied({bot_manager:{provider_control_challenge_verified:false}},'INDEPENDENT_BOT_MANAGER_CONTROL_NOT_ATTESTED'));
test('owner cannot self sign Bot Manager reviewer evidence',async()=>denied({bot_manager:{review_operator_distinct_from_owner:false}},'INDEPENDENT_BOT_MANAGER_CONTROL_NOT_ATTESTED'));
test('Supabase role manager not owner blocks',async()=>denied({supabase_owner:{membership_role:'manager'}},'TRUSTED_SUPABASE_OWNER_MEMBERSHIP_NOT_VERIFIED'));
test('Supabase owner membership inactive blocks',async()=>denied({supabase_owner:{membership_active:false}},'TRUSTED_SUPABASE_OWNER_MEMBERSHIP_NOT_VERIFIED'));
test('Supabase JWT not server validated blocks',async()=>denied({supabase_owner:{jwt_validated_server_side:false}},'TRUSTED_SUPABASE_OWNER_MEMBERSHIP_NOT_VERIFIED'));
test('Supabase user not unique active Owner in Shop B blocks',async()=>denied({supabase_owner:{owner_membership_unique_for_subject:false}},'TRUSTED_SUPABASE_OWNER_MEMBERSHIP_NOT_VERIFIED'));
test('client saying consent=true without signed consent not enough',async()=>{
 const i=evidence();delete i.evidence.merchant_consent;i.consent=true;
 const r=await assessG23(i,server(),now);assert.equal(r.status,'BLOCKED');
});
test('consent not explicit blocks',async()=>denied({merchant_consent:{consent_explicit:false}},'MERCHANT_CONSENT_NOT_INDEPENDENT_OR_EXPLICIT'));
test('consent revoked blocks',async()=>denied({merchant_consent:{consent_revoked:true}},'MERCHANT_CONSENT_NOT_INDEPENDENT_OR_EXPLICIT'));
test('consent asking for real send cannot pass G2.3',async()=>denied({merchant_consent:{consent_scope:'SEND_ALL_MESSAGES'}},'MERCHANT_CONSENT_NOT_INDEPENDENT_OR_EXPLICIT'));
test('consent gesture not observed blocks',async()=>denied({merchant_consent:{user_gesture_verified:false}},'MERCHANT_CONSENT_NOT_INDEPENDENT_OR_EXPLICIT'));
test('consent expired blocks',async()=>denied({merchant_consent:{consent_expires_ms:now-1}},'MERCHANT_CONSENT_NOT_INDEPENDENT_OR_EXPLICIT'));
test('stale owner allowlist blocks',async()=>denied({merchant_consent:{owner_allowlist_exp_ms:now-1}},'OWNER_ALLOWLIST_EXPIRED_OR_UNBOUND'));
test('staging bot candidate expired blocks',async()=>denied({},'G22_CANDIDATE_NOT_AVAILABLE_OR_EXPIRED',server({verifyG22CandidateReadOnly:async()=>false})));
test('staging bot candidate database unavailable blocks',async()=>denied({},'G22_CANDIDATE_NOT_AVAILABLE_OR_EXPIRED',server({verifyG22CandidateReadOnly:async()=>{throw Error('DB_UNAVAILABLE')}})));
test('durable nonce store unavailable blocks',async()=>denied({},'CHALLENGE_REPLAY_OR_DURABLE_STORE_UNAVAILABLE',server({consumeOnce:async()=>{throw Error('STORE_UNAVAILABLE')}})));
test('same nonce two calls replay blocked',async()=>{
 const s=server();const a=await assessG23(evidence(),s,now);const b=await assessG23(evidence(),s,now);
 assert.equal(a.status,'ELIGIBLE_FOR_PRIVATE_HUMAN_REVIEW_ONLY');
 assert.equal(b.status,'BLOCKED');assert.ok(b.blocked_reasons.includes('CHALLENGE_REPLAY_OR_DURABLE_STORE_UNAVAILABLE'));
});
test('tampering signed consent payload fails signature',async()=>{
 const i=evidence();i.evidence.merchant_consent.payload=i.evidence.merchant_consent.payload.replace('NO_SEND','SEND_REAL');
 const r=await assessG23(i,server(),now);
 assert.ok(r.blocked_reasons.includes('MISSING_OR_INVALID_MERCHANT_CONSENT_SIGNED_PROOF'));
});
test('false owner allowlist boolean blocks',async()=>denied({merchant_consent:{owner_allowlist_verified:false}},'OWNER_ALLOWLIST_EXPIRED_OR_UNBOUND'));
test('Shop A trusted scope setting blocks',async()=>{
 const s=server({storeScope:'QA_SHOP_A_ONLY'});const r=await assessG23(evidence(),s,now);assert.equal(r.status,'BLOCKED');
});
test('non-ECDSA signer key blocks',async()=>assert.equal(verifiedRoots({...roots,[ROLES.zalo_user]:'bad'}),false));
