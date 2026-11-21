// V19.8.2 CANDIDATE: synthetic fixture ONLY. No real JWT verification, no hosted DB access.
export function assessStoreRead(d) {
 const deny=(reason)=>({decision:'DENY',reason,canReadHosted:false,canSend:false,canWrite:false});
 if(!d||d.testSource!=='SYNTHETIC_QA' || d.environment!=='isolated_test')return deny('NOT_QA');
 const {session,tenantMembership,storeMembership,installation,store,product,receipt}=d;
 if(!session||session.proof!=='MOCK_JWT_NOT_REAL'||!session.active||!session.userRef)return deny('SESSION_NOT_VERIFIED');
 if(!receipt||receipt.proof!=='MOCK_PROVIDER_ONLY'||receipt.signed!==true||receipt.fresh!==true||receipt.unique!==true||receipt.privateChat!==true||receipt.botEcho!==false)return deny('UNTRUSTED_RECEIPT');
 if(!installation||installation.source!=='SERVER_FIXTURE'||installation.active!==true||installation.channel!=='zalo_bot'||!installation.botRef||receipt.botRef!==installation.botRef)return deny('BOT_INSTALLATION_UNBOUND');
 if(!store||store.id!==installation.storeId||store.tenantId!==installation.tenantId||store.active!==true)return deny('CANONICAL_STORE_MISSING');
 if(!tenantMembership||tenantMembership.source!=='SERVER_FIXTURE'||tenantMembership.active!==true||tenantMembership.userRef!==session.userRef||tenantMembership.tenantId!==store.tenantId)return deny('TENANT_MEMBERSHIP_DENIED');
 if(!storeMembership||storeMembership.source!=='SERVER_FIXTURE'||storeMembership.active!==true||storeMembership.userRef!==session.userRef||storeMembership.tenantId!==store.tenantId||storeMembership.storeId!==store.id||!['owner','manager'].includes(storeMembership.role))return deny('STORE_MEMBERSHIP_DENIED');
 if(d.clientClaims && ['tenantId','storeId','admin','serviceRole','owner','canWrite','botRef'].some(k=>Object.prototype.hasOwnProperty.call(d.clientClaims,k)))return deny('CLIENT_PRIVILEGE_HINT');
 if(!product||product.source!=='STORE_SCOPED_FIXTURE'||product.tenantId!==store.tenantId||product.storeId!==store.id)return deny('CROSS_STORE_PRODUCT');
 if(typeof product.sku!=='string'||!/^[A-Z][A-Z0-9-]{1,20}$/.test(product.sku)||!Number.isSafeInteger(product.priceVnd)||product.priceVnd<=0||!Number.isSafeInteger(product.stock)||product.stock<0)return deny('INVALID_CATALOG');
 return {decision:'SYNTHETIC_READ_PLAN_ONLY',reason:'NEVER_PROOF_OF_REAL_STORE_AUTH',storeScope:'synthetic',sku:product.sku,canReadHosted:false,canSend:false,canWrite:false};
}

export function assessBackfillPreview(d) {
 const deny=reason=>({decision:'BLOCKED',reason,mutated:false,rowsUpdated:0});
 if(!d||d.source!=='SERVER_INVENTORY_FIXTURE'||d.operatorApproval!==true)return deny('NO_APPROVAL_EVIDENCE');
 if(!Array.isArray(d.rows)||!Array.isArray(d.canonicalStores)||!Array.isArray(d.ownershipProofs))return deny('INVALID_INVENTORY');
 if(d.pendingWrites!==0||d.ambiguousLineage!==0)return deny('WRITER_OR_AMBIGUOUS_LINEAGE');
 const tenants=new Map();
 for(const store of d.canonicalStores){
  if(!store||!store.tenantId||!store.storeId||store.ownerVerified!==true)return deny('CANONICAL_OWNER_NOT_VERIFIED');
  tenants.set(store.tenantId,[...(tenants.get(store.tenantId)||[]),store.storeId]);
 }
 for(const row of d.rows) {
  if(!row||!row.tenantId||row.storeId!==null)return deny('ROW_NOT_UNASSIGNED');
  const matches=tenants.get(row.tenantId)||[];
  if(matches.length!==1)return deny('ZERO_OR_MULTI_STORE_AMBIGUITY');
  if(!d.ownershipProofs.some(x=>x.tenantId===row.tenantId&&x.storeId===matches[0]&&x.verified===true))return deny('MISSING_ROW_OWNER_PROOF');
 }
 return {decision:'SYNTHETIC_BACKFILL_PLAN_ONLY',mutated:false,rowsUpdated:0,proposedRows:d.rows.length};
}
