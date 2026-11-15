'use strict';
/**
 * V13.6M.6 — P0 hosted replay security REVIEW gate.
 * SOURCE ONLY: evidence is synthetic; this module never authorizes hosted
 * access, role creation, RLS migration, real order updates or Meta sends.
 */
const FLAGS=Object.freeze([
 'restorableBackup','rollbackRehearsed','canonicalStoreSchema',
 'productsStoreId','privatePageOwnerMapping','privateReplaySchema',
 'privateSchemaNotExposed','restrictedDbRoleVerified',
 'roleCannotBypassRls','privateGrantsAudited','storeForceRls',
 'sameTenantTwoStoreNegativeQa','crossTenantNegativeQa',
 'ownerRevocationNegativeQa','providerSendDisabled',
 'atomicPostgresUniqueQa','crashRestartNegativeQa',
 'retentionAndTombstonesApproved','keyRotationDualReadQa',
 'subscriptionEntitlementVerified','ownerMigrationApproval'
]);
const MAX_AGE=24*60*60*1000;
const fail=code=>{const e=new Error(code);e.code=code;throw e};
function assessHostedReplayGate({mode='BLOCKED',evidence,now=Date.now}={}){
 if(mode!=='SYNTHETIC_READINESS_REVIEW')fail('M6_HOSTED_GATE_UNAVAILABLE');
 if(typeof now!=='function'||!Number.isSafeInteger(now()))fail('M6_CLOCK_INVALID');
 if(!evidence||evidence.source!=='SYNTHETIC_QA_EVIDENCE'||
    !Number.isSafeInteger(evidence.checkedAtMs)||
    evidence.checkedAtMs>now()||now()-evidence.checkedAtMs>MAX_AGE||
    typeof evidence.facts!=='object'||!evidence.facts)
   fail('M6_EVIDENCE_INVALID_OR_STALE');
 const missing=FLAGS.filter(k=>evidence.facts[k]!==true);
 return Object.freeze({
  stage:'V13.6M.6',
  status:missing.length?'BLOCKED_IN_SYNTHETIC_REVIEW':'SATISFIED_IN_FIXTURE_ONLY',
  missing:Object.freeze(missing),
  factCount:FLAGS.length,
  readyForOwnerReview:missing.length===0,
  hostedReplayEnabled:false,
  authorizedSchemaMigration:false,
  canModifyRls:false,canUseCredential:false,
  canWriteOrders:false,canSendMessenger:false,
  realPostgresVerified:false,
  ownerApprovalVerified:false,
  keyRotationActivated:false
 });
}
/**
 * READ-ONLY schema discovery, intentionally NOT executed by this module.
 * Requires real inspection of schema exposure, role memberships and FORCE
 * RLS before a separate user-approved hosted test.
 */
const READINESS_SQL=[
 "SELECT",
 "to_regclass('public.stores') IS NOT NULL AS stores_ready,",
 "to_regclass('public.store_memberships') IS NOT NULL AS store_memberships_ready,",
 "to_regclass('app_private.messenger_page_bindings') IS NOT NULL AS private_page_ready,",
 "to_regclass('app_private.messenger_event_claims') IS NOT NULL AS private_events_ready,",
 "EXISTS(SELECT 1 FROM information_schema.columns",
 " WHERE table_schema='public' AND table_name='products' AND column_name='store_id') AS product_scope_ready,",
 "EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace",
 " WHERE n.nspname='app_private' AND c.relname='messenger_event_claims'",
 " AND c.relrowsecurity AND c.relforcerowsecurity) AS private_event_force_rls_ready"
].join('\n');
module.exports={assessHostedReplayGate,FLAGS,READINESS_SQL};
