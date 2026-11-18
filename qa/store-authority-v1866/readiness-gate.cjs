'use strict';
// V18.6.6: metadata-only consolidation gate. No network, Auth, secret, RPC or database access.
// This gate cannot authorize real Owner A/B UAT, Meta OAuth or Production.
const fs = require('node:fs');
const path = require('node:path');
const BLOCKER = Object.freeze({
  CANONICAL_STORE_SCHEMA_MISSING: 'CANONICAL_STORE_SCHEMA_MISSING',
  COMMERCE_STORE_ID_MISSING: 'COMMERCE_STORE_ID_MISSING',
  RESTRICTIVE_STORE_RLS_MISSING: 'RESTRICTIVE_STORE_RLS_MISSING',
  REAL_OWNER_AB_NOT_VERIFIED: 'REAL_OWNER_AB_NOT_VERIFIED',
  SAME_TENANT_AB_NOT_VERIFIED: 'SAME_TENANT_AB_NOT_VERIFIED',
  AUTH_BACKEND_NOT_VERIFIED: 'AUTH_BACKEND_NOT_VERIFIED',
  LEGACY_WRITER_NOT_SCOPED: 'LEGACY_WRITER_NOT_SCOPED',
  RPC_CALLERS_UNKNOWN: 'RPC_CALLERS_UNKNOWN',
  BACKUP_RESTORE_NOT_APPROVED: 'BACKUP_RESTORE_NOT_APPROVED',
  LEGACY_MAPPING_NOT_APPROVED: 'LEGACY_MAPPING_NOT_APPROVED',
  ROLE_CONTRACT_CONFLICT: 'ROLE_CONTRACT_CONFLICT',
  SKU_DECISION_OPEN: 'SKU_DECISION_OPEN',
  META_APP_REVIEW_MISSING: 'META_APP_REVIEW_MISSING',
  REAL_OAUTH_NOT_VERIFIED: 'REAL_OAUTH_NOT_VERIFIED'
});
const fail = code => Object.freeze({version:'V18.6.6', status:'BLOCKED', code,
  realUatApproved:false, metaOAuthApproved:false, productionReady:false,
  authorizesMigration:false, requiresPrivateHostEvidence:true, blockers:Object.freeze([])});
function evaluate(snapshot) {
  if(!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot) ||
     snapshot.version !== 'V18.6.6' ||
     snapshot.classification !== 'READ_ONLY_METADATA_SNAPSHOT_NOT_HOSTED_AUTH_PROOF' ||
     snapshot.environment !== 'TIEN404_SUPABASE_STAGING' ||
     !snapshot.supabase || !snapshot.cloudflare || !snapshot.meta || !snapshot.decisions || !snapshot.safety ||
     Object.values(snapshot.safety).some(x=>x!==0)) return fail('INVALID_OR_UNSAFE_EVIDENCE');
  const s=snapshot.supabase, c=snapshot.cloudflare, m=snapshot.meta,d=snapshot.decisions;
  if(!Number.isInteger(s.canonicalTablesPresent)||!Number.isInteger(s.expectedCanonicalTables)||
    !Number.isInteger(s.commerceTablesWithStoreId)||!Number.isInteger(s.expectedCommerceTables)||
    !Number.isInteger(s.publicRestrictivePolicies)||s.expectedCanonicalTables!==2||s.expectedCommerceTables!==6 ||
    s.canonicalTablesPresent<0 ||s.commerceTablesWithStoreId<0 ||s.publicRestrictivePolicies<0) return fail('INVALID_OR_UNSAFE_EVIDENCE');
  const b=[];
  const block=(bad,code)=>{if(bad)b.push(code)};
  block(s.canonicalTablesPresent!==s.expectedCanonicalTables,BLOCKER.CANONICAL_STORE_SCHEMA_MISSING);
  block(s.commerceTablesWithStoreId!==s.expectedCommerceTables,BLOCKER.COMMERCE_STORE_ID_MISSING);
  block(s.publicRestrictivePolicies<6,BLOCKER.RESTRICTIVE_STORE_RLS_MISSING);
  block(s.verifiedRealOwnerABSessions!==true,BLOCKER.REAL_OWNER_AB_NOT_VERIFIED);
  block(s.realSameTenantStoreABTested!==true,BLOCKER.SAME_TENANT_AB_NOT_VERIFIED);
  block(c.supabaseAuthBindingVerified!==true || c.ownerAuthToWorkerEndToEndVerified!==true,BLOCKER.AUTH_BACKEND_NOT_VERIFIED);
  block(s.privilegedWritersStoreAware!==true,BLOCKER.LEGACY_WRITER_NOT_SCOPED);
  block(s.rpcCallerInventoryComplete!==true,BLOCKER.RPC_CALLERS_UNKNOWN);
  block(s.approvedBackupRestoreEvidence!==true,BLOCKER.BACKUP_RESTORE_NOT_APPROVED);
  block(s.approvedLegacyMappingManifest!==true,BLOCKER.LEGACY_MAPPING_NOT_APPROVED);
  block(d.roleCompatibility!=='APPROVED_REVIEWED',BLOCKER.ROLE_CONTRACT_CONFLICT);
  block(d.skuScope==='UNRESOLVED_D02',BLOCKER.SKU_DECISION_OPEN);
  block(m.realMetaAppReviewApproved!==true,BLOCKER.META_APP_REVIEW_MISSING);
  block(m.realFanpageOAuthVerified!==true,BLOCKER.REAL_OAUTH_NOT_VERIFIED);
  // Even if all booleans are edited to true, a source-only JSON snapshot must NEVER become
  // an authority for a hosted session or production release. A separate attested runtime
  // operator workflow and direct RLS proof are required.
  return Object.freeze({version:'V18.6.6',status:b.length?'BLOCKED':'PRIVATE_ATTESTATION_REQUIRED',
    code:b.length?'MISSING_VERIFIED_PRECONDITIONS':'SNAPSHOT_NOT_AUTHORITY',
    realUatApproved:false,metaOAuthApproved:false,productionReady:false,
    authorizesMigration:false,requiresPrivateHostEvidence:true,
    blockers:Object.freeze(b)});
}
function evaluateBundled() {return evaluate(JSON.parse(fs.readFileSync(path.join(__dirname,'evidence.snapshot.json'),'utf8')))}
module.exports={evaluate,evaluateBundled,BLOCKER};
if(require.main===module) {
  const output=evaluateBundled();
  console.log(JSON.stringify(output,null,2));
  if(output.productionReady || output.realUatApproved || output.authorizesMigration) process.exitCode=2;
}
