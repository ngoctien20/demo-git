'use strict';
/**
 * TIEN404 V15.0-09B owner evidence readiness inspector — PURE/OFFLINE ONLY.
 * It does NOT perform JWT validation, access a DB, attest owner identity,
 * verify signatures, or grant privileges. Untrusted fixture input stays data.
 */
const {createHash}=require('node:crypto');
const ID=/^[A-Za-z0-9_-]{3,100}$/;
const BLOCK=reason=>Object.freeze({status:'BLOCKED',reason,
 certified_real_owner:false,can_read_hosted:false,can_send:false,can_write_orders:false});
function assessOwnerEvidence(rows,{now=()=>Date.now()}={}){
 if(!rows||typeof rows!=='object'||Array.isArray(rows)||
   ['user','tenantMembership','store','storeMembership','channelConsent'].some(k=>!rows[k]||typeof rows[k]!=='object'))
   return BLOCK('MISSING_FOUR_ROW_OR_CONSENT_EVIDENCE');
 const {user,tenantMembership:tm,store,storeMembership:sm,channelConsent:c}=rows;
 if(!ID.test(user.id||'')||user.status!=='ACTIVE'||user.syntheticFixture!==true)
   return BLOCK('USER_NOT_IN_PRIVATE_QA_EVIDENCE');
 if(!ID.test(tm.tenantId||'')||tm.userId!==user.id||tm.active!==true||!['owner','manager'].includes(tm.role))
   return BLOCK('TENANT_MEMBERSHIP_NOT_PROVEN');
 if(!ID.test(store.id||'')||store.tenantId!==tm.tenantId||store.status!=='ACTIVE')
   return BLOCK('CANONICAL_STORE_NOT_PROVEN');
 if(sm.userId!==user.id||sm.tenantId!==tm.tenantId||sm.storeId!==store.id||
   sm.active!==true||!['owner','manager'].includes(sm.role))
   return BLOCK('STORE_MEMBERSHIP_NOT_PROVEN');
 if(c.ownerUserId!==user.id||c.tenantId!==tm.tenantId||c.storeId!==store.id||
   !ID.test(c.providerAccountRef||'')||!ID.test(c.providerBotRef||'')||
   c.status!=='INDEPENDENTLY_VERIFIED_QA_FIXTURE'||
   !Number.isSafeInteger(c.expiresAtMs)||c.expiresAtMs<=now()||
   c.revoked!==false)
   return BLOCK('PROVIDER_OWNER_CONSENT_NOT_PROVEN');
 const receipt=createHash('sha256').update(JSON.stringify({
  actor:user.id,tenant:tm.tenantId,store:store.id,
  provider:c.providerAccountRef,bot:c.providerBotRef
 })).digest('hex');
 return Object.freeze({status:'SYNTHETIC_FOUR_ROW_CHAIN_READY_NOT_HOSTED',
   evidence_ref:receipt,owner_proof_rows:4,consent_fixture_checked:true,
   certified_real_owner:false,hosted_jwt_verified:false,
   hosted_store_rls_verified:false,can_read_hosted:false,
   can_send:false,can_write_orders:false,
   next_gate:'INDEPENDENT_AUTH_AND_PROVIDER_EVIDENCE_WITH_REAL_HOSTED_STORE_ROWS'});
}
module.exports={assessOwnerEvidence};
