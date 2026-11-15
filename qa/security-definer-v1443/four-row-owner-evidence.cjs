'use strict';
/**
 * TIEN404 V14.4.3 — PRIVATE/OFFLINE four-row attribution evidence LINTER.
 *
 * Inputs may hold real row UUIDs/tenant IDs/merchant QA identities. Keep them
 * on an authorized operator machine only. NEVER persist, print, upload, send
 * to GitHub Actions, or log them. Output is counts + generic flags ONLY.
 *
 * This is NOT a verifier of signatures, Auth sessions, DB snapshots or actual
 * ownership; all review metadata is untrusted until independently inspected.
 * The module deliberately has NO DB, network, SQL, backfill or role APIs.
 */
const PROJECT='ifxlvrhyjhbzbrkdsida';
const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEX=/^[a-f0-9]{64}$/i;
const EREF=/^EVD-[A-Z0-9]{12}$/;
const TABLES=Object.freeze(['products','orders']);
const TYPES=Object.freeze({
 products:Object.freeze(['PRODUCT_CATALOG_SOURCE','MERCHANT_STORE_ATTESTATION',
  'INDEPENDENT_QA_REVIEW']),
 orders:Object.freeze(['ORDER_ORIGIN_SOURCE','MERCHANT_STORE_ATTESTATION',
  'INDEPENDENT_QA_REVIEW'])
});
const ROW_KEYS=new Set(['table','rowId','tenantId','candidateStoreId',
 'snapshotSha256','sourceUpdatedAt','merchantActorId','reviewerActorId','evidence']);
const EVIDENCE_KEYS=new Set(['type','reference','rowId','tenantId','storeId',
 'snapshotSha256','actorId','signedAt']);
const add=(set,reason)=>set.add(reason);
function isUtcIso(x,now){
 if(typeof x!=='string'||!/^20\d\d-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(x))return false;
 const parsed=Date.parse(x);
 return Number.isFinite(parsed)&&parsed<=now&&parsed>=Date.parse('2020-01-01T00:00:00.000Z');
}
function reviewPrivateEvidence({projectRef,mode,rows,baseline}={},now=Date.now()){
 const why=new Set(), seen=new Set(), refs=new Set(),storeTenants=new Map();
 const counts={products:0,orders:0};
 if(projectRef!==PROJECT||mode!=='PRIVATE_OPERATOR_REVIEW_ONLY')
  add(why,'PRIVATE_PROJECT_SCOPE_NOT_ATTESTED');
 if(!Array.isArray(rows)||rows.length!==4)add(why,'FOUR_LEGACY_ROWS_NOT_PROVIDED');
 if(baseline?.products!==2||baseline?.orders!==2||baseline?.distinctTenants!==2||
    baseline?.eachTenantHasOneProductAndOneOrder!==true)
  add(why,'LIVE_BASELINE_NOT_RECONCILED');
 const all=Array.isArray(rows)?rows:[];
 const tenants=new Map();
 for(const r of all){
  if(!r||typeof r!=='object'||Array.isArray(r)){
   add(why,'UNSUPPORTED_PRIVATE_LEDGER_ROW');continue;
  }
  if(Object.keys(r).some(k=>!ROW_KEYS.has(k)))add(why,'UNEXPECTED_PRIVATE_ROW_FIELD');
  if(!TABLES.includes(r.table)){add(why,'INVALID_TABLE');continue;}
  counts[r.table]++;
  if(![r.rowId,r.tenantId,r.candidateStoreId,r.merchantActorId,r.reviewerActorId].every(x=>
      typeof x==='string'&&ID.test(x)))
   add(why,'RECORD_OR_ACTOR_SCOPE_INVALID');
  if(r.merchantActorId===r.reviewerActorId)
   add(why,'SAME_MERCHANT_AND_REVIEWER');
  if(!HEX.test(r.snapshotSha256||''))add(why,'SNAPSHOT_DIGEST_INVALID');
  if(!isUtcIso(r.sourceUpdatedAt,now))add(why,'SOURCE_TIMESTAMP_INVALID');
  const rowKey=r.table+':'+r.rowId;
  if(seen.has(rowKey))add(why,'DUPLICATE_SOURCE_ROW');
  seen.add(rowKey);
  if(ID.test(r.tenantId||'')){
   const ct=tenants.get(r.tenantId)||{products:0,orders:0};
   ct[r.table]++;tenants.set(r.tenantId,ct);
  }
  if(ID.test(r.candidateStoreId||'')&&ID.test(r.tenantId||'')){
   const existing=storeTenants.get(r.candidateStoreId);
   if(existing&&existing!==r.tenantId)add(why,'STORE_MAPPED_TO_TWO_TENANTS');
   storeTenants.set(r.candidateStoreId,r.tenantId);
  }
  if(!Array.isArray(r.evidence)||r.evidence.length!==3){
    add(why,'EXACTLY_THREE_PRIVATE_EVIDENCE_ITEMS_REQUIRED');continue;
  }
  const expected=TYPES[r.table],observed=new Set();
  for(const e of r.evidence){
   if(!e||typeof e!=='object'||Array.isArray(e)){
    add(why,'INVALID_EVIDENCE_ITEM');continue;
   }
   if(Object.keys(e).some(k=>!EVIDENCE_KEYS.has(k)))
    add(why,'UNEXPECTED_EVIDENCE_FIELD');
   if(!expected.includes(e.type))add(why,'INVALID_EVIDENCE_CLASS');
   if(observed.has(e.type))add(why,'DUPLICATED_EVIDENCE_CLASS');
   observed.add(e.type);
   if(!EREF.test(e.reference||''))add(why,'INVALID_OPAQUE_EVIDENCE_REFERENCE');
   if(refs.has(e.reference))add(why,'DUPLICATE_EVIDENCE_REFERENCE');
   refs.add(e.reference);
   if(e.rowId!==r.rowId||e.tenantId!==r.tenantId||
      e.storeId!==r.candidateStoreId||e.snapshotSha256!==r.snapshotSha256)
    add(why,'UNBOUND_EVIDENCE_SCOPE');
   if(!isUtcIso(e.signedAt,now))add(why,'EVIDENCE_TIMESTAMP_INVALID');
   const reviewer=e.type==='INDEPENDENT_QA_REVIEW';
   if(e.actorId!==(reviewer?r.reviewerActorId:r.merchantActorId))
    add(why,'SIGNER_IDENTITY_MISMATCH');
  }
  if(expected.some(e=>!observed.has(e)))add(why,'REQUIRED_EVIDENCE_CLASS_MISSING');
 }
 if(counts.products!==2||counts.orders!==2)add(why,'EXACTLY_TWO_PRODUCTS_AND_TWO_ORDERS');
 if(tenants.size!==2||[...tenants.values()].some(x=>x.products!==1||x.orders!==1))
   add(why,'TENANT_PAIRING_NOT_MATCHING_LIVE_BASELINE');
 return Object.freeze({
  mode:'PRIVATE_OFFLINE_LINT_ONLY',projectRef:PROJECT,
  status:why.size?'INCOMPLETE_OR_INCONSISTENT_CLAIMS':'READY_FOR_MANUAL_PRIVATE_EVIDENCE_INSPECTION',
  issues:Object.freeze([...why].sort()),candidateProducts:counts.products,
  candidateOrders:counts.orders,independentRealSignatureCheck:false,
  independentlyVerifiedOwners:0,verifiedHostedRows:0,
  baselineRevalidatedWithReadOnlyDB:false,
  // Deliberately refuse to export raw record identifiers or artifacts.
  containsRecordIdentifiers:false,containsCustomerData:false,
  canBackfill:false,canChangeRls:false,canCreateStore:false,
  canUseServiceRoleForRlsProof:false,canPublish:false,
  realOwnerAttributionVerified:false,recordsWritten:0
 });
}
module.exports={PROJECT,TYPES,reviewPrivateEvidence};
