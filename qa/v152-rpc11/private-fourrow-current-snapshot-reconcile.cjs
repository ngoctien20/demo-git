'use strict';
/*
 * TIEN404 RPC.11 — compare a private 4-row CURRENT metadata snapshot
 * against the EXISTING V14.4.3 private evidence ledger.
 *
 * IMPORTANT: The inputs are UNTRUSTED. This is a STRUCTURAL cross-check,
 * not authentication of a hosted Supabase session, signing authority,
 * source database bytes, or merchant-to-Store provenance.
 *
 * No IO, credentials, network, DB, exports, logging or row identifiers out.
 */
const {reviewPrivateFourRow}=require('../v152-rpc6/fourrow-recovery-migration-gate.cjs');
const baseline=require('../v152-rpc6/hosted-fourrow-recovery-baseline.json');
const CONTRACT='T404_RPC11_CURRENT_PRIVATE_FOUR_ROW_JOIN_V1';
const PROJECT='ifxlvrhyjhbzbrkdsida';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA=/^[a-f0-9]{64}$/i;
const isPlain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
const iso=x=>typeof x==='string'&&/^20\d\d-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(x)&&Number.isFinite(Date.parse(x));
const exact=(v,k)=>isPlain(v)&&Object.keys(v).length===k.length&&k.every(a=>Object.hasOwn(v,a));
const freeze=a=>Object.freeze([...new Set(a)].sort());
function reconcilePrivateRows({snapshot,ownerLedger,now=Date.now()}={}){
 const errors=new Set(),fail=x=>errors.add(x);
 if(!Number.isSafeInteger(now)||now<=0)fail('INVALID_LOCAL_REVIEW_CLOCK');
 if(!exact(snapshot,['contract','projectRef','capturedAtUtc','rows'])||
   snapshot.contract!=='T404_RPC11_CURRENT_ROW_METADATA_SNAPSHOT_V1'||
   snapshot.projectRef!==PROJECT)fail('PRIVATE_SOURCE_SNAPSHOT_CONTRACT_INVALID');
 if(!iso(snapshot?.capturedAtUtc)||
    !Number.isFinite(now)||
    Date.parse(snapshot.capturedAtUtc)>now+60000||
    now-Date.parse(snapshot.capturedAtUtc)>10*60000)
  fail('PRIVATE_SOURCE_SNAPSHOT_NOT_RECENT');
 const rows=Array.isArray(snapshot?.rows)?snapshot.rows:[];
 if(rows.length!==4)fail('EXPECTED_EXACT_FOUR_SNAPSHOT_ROWS');
 const counts={products:0,orders:0},pairs=new Map(),tenants=new Map();
 for(const r of rows){
  if(!exact(r,['table','rowId','tenantId','sourceUpdatedAt','sourceSha256'])){
   fail('PRIVATE_SNAPSHOT_ROW_SHAPE_INVALID');continue;
  }
  if(!Object.hasOwn(counts,r.table)){
   fail('PRIVATE_SNAPSHOT_TABLE_INVALID');continue;
  }
  counts[r.table]++;
  if(![r.rowId,r.tenantId].every(x=>typeof x==='string'&&UUID.test(x))||
     !SHA.test(r.sourceSha256)||!iso(r.sourceUpdatedAt)||
     Date.parse(r.sourceUpdatedAt)>now+60000){
   fail('PRIVATE_SNAPSHOT_ROW_METADATA_INVALID');continue;
  }
  const k=r.table+':'+r.rowId.toLowerCase();
  if(pairs.has(k))fail('PRIVATE_SNAPSHOT_DUPLICATE_ROW');
  pairs.set(k,r);
  const t=r.tenantId.toLowerCase();
  const count=tenants.get(t)||{products:0,orders:0};
  count[r.table]++;
  tenants.set(t,count);
 }
 if(counts.products!==2||counts.orders!==2)fail('PRIVATE_SNAPSHOT_NOT_TWO_PRODUCTS_TWO_ORDERS');
 if(tenants.size!==2||[...tenants.values()].some(t=>t.products!==1||t.orders!==1))
  fail('PRIVATE_SNAPSHOT_TENANT_PAIRING_MISMATCH');
 const claim=reviewPrivateFourRow({snapshot:baseline,privatePacket:ownerLedger,now});
 if(claim.status!=='PRIVATE_LEDGER_FORMAT_READY_FOR_REAL_REVIEW')
  fail('INHERITED_PRIVATE_OWNER_LINTER_NOT_READY');
 const ledgerRows=Array.isArray(ownerLedger?.rows)?ownerLedger.rows:[];
 if(ledgerRows.length!==4)fail('PRIVATE_LEDGER_FOUR_ROW_JOIN_INCOMPLETE');
 for(const r of ledgerRows){
  if(!isPlain(r)||typeof r.rowId!=='string'||typeof r.table!=='string'){
   fail('PRIVATE_LEDGER_ROW_SHAPE_INVALID');continue;
  }
  const m=pairs.get(r.table+':'+r.rowId.toLowerCase());
  if(!m)fail('PRIVATE_OWNER_LEDGER_ROW_NOT_IN_SNAPSHOT');
  else{
   if(typeof r.tenantId!=='string'||
      m.tenantId.toLowerCase()!==r.tenantId.toLowerCase())
     fail('PRIVATE_LEDGER_TENANT_MISMATCH');
   if(m.sourceUpdatedAt!==r.sourceUpdatedAt)
     fail('PRIVATE_LEDGER_ROW_VERSION_STALE');
   if(m.sourceSha256.toLowerCase()!==String(r.snapshotSha256||'').toLowerCase())
     fail('PRIVATE_LEDGER_SNAPSHOT_DIGEST_MISMATCH');
  }
 }
 const ok=errors.size===0;
 return Object.freeze({
  contract:CONTRACT,
  status:ok?'STRUCTURAL_ROW_JOIN_READY_FOR_EXTERNAL_PRIMARY_SOURCE_REVIEW':'PRIVATE_ROW_JOIN_NO_GO',
  blockers:freeze(errors),
  snapshotProducts:counts.products,snapshotOrders:counts.orders,
  matchedSnapshotAndLedgerRows:ok?4:0,distinctTenants:tenants.size,
  actualCurrentHostedSnapshotAuthenticated:false,
  actualOriginalStoreSourceInspected:false,
  independentMerchantReviewerAuthorityVerified:false,
  cryptographicEvidenceSignaturesVerified:false,
  actualOwnerToCanonicalStoreProven:false,
  containsRowIdentifiers:false,containsPrivateSourceDigests:false,
  canReadHostedRows:false,canCreateStores:false,
  canBackfill:false,canChangeRls:false,canMigrate:false,canRevokeRpc:false,
  customerDataChanged:0
 });
}
module.exports=Object.freeze({CONTRACT,PROJECT,reconcilePrivateRows});
