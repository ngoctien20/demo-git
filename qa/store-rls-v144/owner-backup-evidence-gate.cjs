'use strict';
/**
 * TIEN404 V14.4A.1 — P0 store ownership + backup metadata review only.
 *
 * This intentionally consumes ONLY sanitized aggregate tenant aliases, not
 * UUIDs, customer records, phones, orders, access tokens or dump contents.
 * It cannot establish per-row ownership, restore data or authorize SQL.
 * All assertions about mappings remain CANDIDATES until private owner and
 * independent reviewer inspect each real row.
 */
const TENANTS=Object.freeze({
 'qa-staging-shop-a-20261110':'qa-store-a',
 'qa-staging-shop-b-20261110':'qa-store-b'
});
const TABLES=Object.freeze(['products','orders']);
const EXPECTED=4;
const STOP=Object.freeze({
 can_execute_migration:false,
 can_backfill:false,
 can_replace_rls:false,
 can_access_real_messenger:false,
 hosted_jwt_rls_verified:false,
 owner_mapping_approved:false,
 backup_restorable_verified:false
});
const fail=c=>{const e=new Error(c);e.code=c;throw e};
function summarizeSanitizedCandidates({mode='BLOCKED',rows}={}){
 if(mode!=='READ_ONLY_AGGREGATE_REVIEW')fail('OWNER_REVIEW_READ_ONLY_REQUIRED');
 if(!Array.isArray(rows)||rows.length!==EXPECTED)fail('OWNER_AGGREGATE_DRIFT_OR_MISSING');
 const seen=new Set();
 for(const r of rows){
  if(!r||!Object.hasOwn(TENANTS,r.qa_tenant_alias)||
     !TABLES.includes(r.kind)||r.row_count!==1||
     r.synthetic_candidate_count!==1||
     r.candidate_alias!==TENANTS[r.qa_tenant_alias])
    fail('OWNER_CANDIDATE_NOT_VERIFIED');
  const k=r.qa_tenant_alias+'|'+r.kind;
  if(seen.has(k))fail('OWNER_AGGREGATE_DUPLICATE');
  seen.add(k);
 }
 for(const t of Object.keys(TENANTS))for(const table of TABLES){
   if(!seen.has(t+'|'+table))fail('OWNER_EXPECTED_PAIR_MISSING');
 }
 return Object.freeze({
  stage:'V14.4A.1',
  status:'FOUR_QA_ROWS_AGGREGATED_BUT_OWNER_UNVERIFIED',
  readOnlyTenantGroups:Object.keys(TENANTS).length,
  countedProductRows:2,
  countedOrderRows:2,
  candidateStoreAliasesOnly:Object.freeze([...new Set(Object.values(TENANTS))]),
  independentRowReviewRequired:EXPECTED,
  verifiedOwnerRows:0,
  includesPrivateRowIds:false,
  ...STOP
 });
}
function reviewLocalArchiveReport({mode='BLOCKED',report,nowMs=Date.now()}={}){
 if(mode!=='OFFLINE_ARCHIVE_METADATA_REVIEW')fail('BACKUP_REVIEW_OFFLINE_ONLY');
 if(!report||report.checkpoint!=='TIEN404_V144_LOCAL_BACKUP_EVIDENCE'||
    report.prod_or_staging_modified!==false||
    !Number.isSafeInteger(nowMs)||
    typeof report.timestamp_utc!=='string'||!Number.isFinite(Date.parse(report.timestamp_utc))||
    Date.parse(report.timestamp_utc)>nowMs+60000||
    typeof report.byte_size!=='number'||!Number.isSafeInteger(report.byte_size)||
    report.byte_size<=0||!/^[a-f0-9]{64}$/i.test(report.sha256||''))
   fail('BACKUP_METADATA_INVALID');
 const present=report.expected_tables_present;
 const allSix=present&&typeof present==='object'&&
   ['products','orders','customers','order_items','conversations','messages']
    .every(k=>present[k]===true);
 const archiveReadable=report.manifest_parse_success===true&&allSix;
 const localRestored=report.restore_executed===true&&
  report.restore_status==='LOCAL_RESTORE_COMPLETED_SCHEMA_COUNTS_ONLY';
 return Object.freeze({
  status:archiveReadable?'ARCHIVE_CATALOG_INSPECTED_ONLY':'INSUFFICIENT_ARCHIVE_CATALOG',
  archiveCatalogChecked:archiveReadable,
  localRestoreReported:localRestored,
  localRestoreIndependentVerified:false,
  datasetIntegrityCompared:false,
  roleAndRlsRestoredVerified:false,
  ownerRollbackSignoff:false,
  includesBackupBytes:false,
  includesBackupFilename:false,
  includesFileHash:false,
  ...STOP
 });
}
function privateReviewChecklist(){
 return Object.freeze({
  rowsToConfirm:EXPECTED,
  items:Object.freeze([
   'Owner privately verifies each product/order UUID against canonical tenant',
   'Owner confirms intended canonical store UUID (not qa-store-a/b alias)',
   'Independent reviewer verifies each row and ownership source',
   'Compare per-row price, total, FK and tenant/store consistency',
   'Record signed evidence outside public GitHub and public chat',
   'No UPDATE or backfill until restorable backup and separate approval'
  ]),
  ...STOP
 });
}
module.exports={summarizeSanitizedCandidates,reviewLocalArchiveReport,privateReviewChecklist,STOP};
