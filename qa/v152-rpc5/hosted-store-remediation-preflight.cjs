'use strict';
/**
 * RPC.5 — read-only PRIVATE EVIDENCE / STORE REMEDIATION / CANARY PREFLIGHT.
 * No network, process env, SQL execution, credentials, host mutations or send.
 * This logic never certifies that a claimed private file was actually inspected.
 * Independent operator must inspect primary evidence out of band.
 */
const CONTRACT='T404_RPC5_REMEDIATION_CANARY_PREFLIGHT_V1';
const PROJECT='ifxlvrhyjhbzbrkdsida';
const PARENT='ad48f13e0394e527202a27c0a145a9368942c844';
const RPC='public.qa_shop_b_zalo_claim(uuid,text,text,text)';
const PHASES=Object.freeze(['M0_PRIVATE_BACKUP_AND_MAPPING',
 'M1_EXPAND_STORE_AND_MEMBERSHIPS',
 'M2_VERIFIED_FOUR_ROW_BACKFILL',
 'M3_COMPOSITE_STORE_FK_AND_UNIQUE',
 'M4_ATOMIC_REPLACE_TENANT_RLS',
 'M5_PRIVATE_GATEWAY_AND_HOSTED_JWT',
 'M6_APPROVED_SINGLE_WRITER_CANARY',
 'M7_SEPARATELY_AUTHORIZED_RPC_REVOKE']);
const EVIDENCE=Object.freeze(['N8N_PUBLISHED_CALL_GRAPH',
 'CLOUDFLARE_RUNTIME_ROUTE_INVENTORY',
 'SUPABASE_POSTGREST_REQUEST_ATTRIBUTION',
 'INDEPENDENT_EXTERNAL_CLIENT_INVENTORY',
 'PRIVATE_FOUR_ROW_OWNER_BACKFILL_LEDGER',
 'REAL_BACKUP_AND_INDEPENDENT_RESTORE',
 'HOSTED_JWT_OWNER_A_B_AND_REVOKED_STAFF',
 'OFFICIAL_PROVIDER_SIGNATURE_AND_REPLAY']);
const sha=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const ref=x=>typeof x==='string'&&/^EV-[A-Z0-9]{12,32}$/.test(x);
const isObj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
 Object.getPrototypeOf(x)===Object.prototype;
const exact=(v,k)=>isObj(v)&&Object.keys(v).length===k.length&&
 k.every(key=>Object.hasOwn(v,key));
function privateEvidenceReview({baseline,records=[]}={}){
 const b=isObj(baseline)?baseline:{};
 const blockers=[];
 if(b.contract!=='T404_RPC5_HOSTED_STORE_REMEDIATION_BASELINE_V1'||
   b.project_ref!==PROJECT||b.inherited_head!==PARENT)
    blockers.push('BASELINE_PROVENANCE_NOT_VERIFIED');
 if(!Array.isArray(records)||records.length!==EVIDENCE.length)
    blockers.push('ALL_EIGHT_PRIMARY_EVIDENCE_DOMAINS_NOT_SUBMITTED');
 else{
   const seen=new Set(),refs=new Set();
   for(const x of records){
     if(!exact(x,['domain','evidenceRef','sha256','privateOperatorInspected',
         'independentReviewerInspected','sourceTimestampVerified'])||
       !EVIDENCE.includes(x.domain)||!ref(x.evidenceRef)||!sha(x.sha256)||
       typeof x.privateOperatorInspected!=='boolean'||
       typeof x.independentReviewerInspected!=='boolean'||
       typeof x.sourceTimestampVerified!=='boolean'||
       seen.has(x.domain)||refs.has(x.evidenceRef)){
       blockers.push('PRIMARY_EVIDENCE_REFERENCE_REJECTED');
       continue;
     }
     seen.add(x.domain);refs.add(x.evidenceRef);
   }
   for(const name of EVIDENCE){
     if(!seen.has(name))blockers.push('MISSING_'+name);
   }
 }
 const safeRecords=Array.isArray(records)?records:[];
 const unsupported=EVIDENCE.filter(domain=>
   !safeRecords.some(r=>r?.domain===domain&&r.privateOperatorInspected===true&&
     r.independentReviewerInspected===true&&r.sourceTimestampVerified===true));
 if(unsupported.length)blockers.push('REAL_INDEPENDENT_INSPECTION_NOT_ESTABLISHED');
 return Object.freeze({
  contract:CONTRACT,mode:'METADATA_REVIEW_ONLY',
  status:blockers.length?'EVIDENCE_INCOMPLETE':'CLAIMED_REFERENCES_NEED_PRIMARY_SOURCE_REVIEW',
  blockers:Object.freeze([...new Set(blockers)]),
  unsupportedDomains:Object.freeze(unsupported),
  actualPrimaryPrivateFilesInspectedByCode:false,
  independentReviewerIdentityVerified:false,
  historicalAndExternalCallersCertified:false,
  realBackupInspected:false,
  permissionToRunHosted:false,permissionToRevoke:false
 });
}
function reviewFourRowBackfill({baseline,ledger=[]}={}){
 const b=isObj(baseline)?baseline:{},errors=[];
 const products=b.tables?.products?.row_count,orders=b.tables?.orders?.row_count;
 const customers=b.tables?.customers?.row_count;
 if(b.project_ref!==PROJECT||products!==2||orders!==2||customers!==0)
  errors.push('HOSTED_BACKFILL_ROW_COUNTS_DRIFT_OR_PROJECT_INVALID');
 if(!Array.isArray(ledger)||ledger.length!==products+orders)
  errors.push('EXACT_PRODUCT_AND_ORDER_ATTRIBUTIONS_REQUIRED');
 else{
  const keys=new Set(),counts={products:0,orders:0};
  for(const x of ledger){
   if(!exact(x,['table','rowDigest','tenantDigest','storeEvidenceRef',
       'ownerVerified','reviewerVerified'])||
      !['products','orders'].includes(x.table)||
      !sha(x.rowDigest)||!sha(x.tenantDigest)||!ref(x.storeEvidenceRef)||
      typeof x.ownerVerified!=='boolean'||typeof x.reviewerVerified!=='boolean'||
      keys.has(x.table+':'+x.rowDigest))
       errors.push('LEDGER_RECORD_INVALID_OR_DUPLICATE');
   else{keys.add(x.table+':'+x.rowDigest);counts[x.table]++;}
  }
  if(counts.products!==2||counts.orders!==2)
   errors.push('EXACT_TWO_PRODUCTS_TWO_ORDERS_REQUIRED');
 }
 return Object.freeze({
   contract:CONTRACT,status:errors.length?'BLOCKED':'SELF_REPORTED_MAPPING_ONLY',
   blockers:Object.freeze([...new Set(errors)]),
   currentProductRows:products??null,currentOrderRows:orders??null,
   currentCustomerRows:customers??null,
   ownerToStoreMappingIndependentlyCertified:false,
   storesBackfilled:0,hostedWrites:0,
   canBackfill:false,canRunMigration:false
 });
}
function inspectCanaryPreflight({baseline,proofs={},parity=[]}={}){
 const b=isObj(baseline)?baseline:{},p=isObj(proofs)?proofs:{};
 const blockers=[];
 const required=[
  'independent_real_caller_review','official_provider_signature',
  'approved_encrypted_backup','independent_restore_pass',
  'verified_owner_four_row_mapping','approved_hosted_store_schema',
  'same_tenant_owner_a_b_get_only_rls_pass',
  'revoked_staff_negative_pass',
  'private_pairing_claim_and_distinct_owner_confirm',
  'single_writer_transaction_and_replay_pass',
  'approved_revert_and_rollback_drill',
  'approved_canary_change_window',
  'runtime_observability_thresholds_signed',
  'independent_security_reviewer_signoff'
 ];
 if(b.contract!=='T404_RPC5_HOSTED_STORE_REMEDIATION_BASELINE_V1'||
   b.project_ref!==PROJECT||b.inherited_head!==PARENT)
   blockers.push('WRONG_BASELINE_PROVENANCE');
 if(b.n8n_published?.z1!=='yIJk8LvJoLF40Z62'||
    b.n8n_published?.z2!=='OgDZNSAvKEvhnAvn'||
    b.rpc?.function!==RPC)
   blockers.push('PUBLISHED_CALLER_VERSION_OR_RPC_SCOPE_DRIFT');
 if(b.rpc?.anon_execute!==true)
   blockers.push('OLD_RPC_PRE_CANARY_PRIVILEGE_SNAPSHOT_DRIFT');
 if(b.tables?.stores?.exists!==true||b.tables?.store_memberships?.exists!==true)
   blockers.push('HOSTED_STORE_SCHEMA_MISSING');
 if(b.tables?.products?.has_store_id!==true||
    b.tables?.orders?.has_store_id!==true||
    b.tables?.customers?.has_store_id!==true)
   blockers.push('COMMERCE_ROWS_NOT_STORE_SCOPED');
 if(b.tables?.products?.old_select_policy||
    b.tables?.orders?.old_select_policy||
    b.tables?.customers?.old_select_policy)
   blockers.push('OLD_TENANT_WIDE_PERMISSIVE_RLS_PRESENT');
 for(const item of required)if(p[item]!==true)
   blockers.push('MISSING_'+item.toUpperCase());
 if(!Array.isArray(parity)||parity.length===0||parity.length>100||
    parity.some(row=>!exact(row,['eventHash','old','candidate'])||
      !sha(row.eventHash)||!['IGNORE','DENY','PENDING'].includes(row.old)||
      !['IGNORE','DENY','PENDING'].includes(row.candidate)))
   blockers.push('SHADOW_PARITY_FIXTURE_INVALID');
 else if(parity.some(row=>row.old!==row.candidate))
   blockers.push('SHADOW_AUTHORIZATION_PARITY_DIVERGED');
 return Object.freeze({
  contract:CONTRACT,status:blockers.length?'NO_GO':'PENDING_EXTERNAL_INDEPENDENT_AUTHORITY',
  phase:'BEFORE_ANY_HOSTED_CANARY',
  blockers:Object.freeze(blockers),
  proposedPhases:PHASES,
  actualPublishedStatusUnchanged:true,
  currentPublicRpcStillCallable:b.rpc?.anon_execute===true,
  evidenceClaimsIndependentAuthority:false,
  hostedJwtTestAuthorized:false,
  sourceQAIsLiveCanaryEvidence:false,
  canaryAuthorized:false,productionTrafficSwitched:false,
  backupExportAuthorized:false,databaseMigrationAuthorized:false,
  rpcRevokeAuthorized:false,providerSendAuthorized:false,canMerge:false,
  hostedWrites:0
 });
}
function requestRealCanary(){
 throw new Error('RPC5_REAL_CANARY_REQUIRES_SEPARATE_CONTROLLER_APPROVAL');
}
module.exports=Object.freeze({
 CONTRACT,PROJECT,PARENT,EVIDENCE,PHASES,privateEvidenceReview,
 reviewFourRowBackfill,inspectCanaryPreflight,requestRealCanary
});