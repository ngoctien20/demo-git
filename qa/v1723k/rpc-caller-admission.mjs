/**
 * TIEN404 V17.23K
 * Public source-only P0/P1 privileged RPC review. Never validate merchant identity,
 * JWTs, secrets, provider signatures, or grant any hosted action from metadata.
 * Raw RPC sources, Vault secrets, event headers, tokens, PII are NOT inputs.
 */
export const EXPECTED_RPC_METADATA = Object.freeze([
 {name:'qa_shop_b_zalo_claim', securityDefiner:true, anonExecute:true, authenticatedExecute:false, authUidCheck:false, vaultHeaderGuard:true, storeAware:true, mutationRisk:true, scope:'SYNTHETIC_QA'},
 {name:'qa_owner_pairing', securityDefiner:true, anonExecute:false, authenticatedExecute:true, authUidCheck:true, vaultHeaderGuard:false, storeAware:true, mutationRisk:true, scope:'SYNTHETIC_QA'},
 {name:'save_merchant_product', securityDefiner:true, anonExecute:false, authenticatedExecute:true, authUidCheck:true, vaultHeaderGuard:false, storeAware:false, mutationRisk:true, scope:'TENANT_ONLY'},
 {name:'merchant_revenue_v3', securityDefiner:false, anonExecute:false, authenticatedExecute:true, authUidCheck:true, vaultHeaderGuard:false, storeAware:false, mutationRisk:false, scope:'TENANT_ONLY'},
 {name:'merchant_paid_orders_daily', securityDefiner:false, anonExecute:false, authenticatedExecute:true, authUidCheck:true, vaultHeaderGuard:false, storeAware:false, mutationRisk:false, scope:'TENANT_ONLY'}
]);
export const PUBLISHED_CALLER_CHAIN = Object.freeze([
 Object.freeze({workflowId:'yIJk8LvJoLF40Z62',type:'n8n',via:'executeWorkflow',targetWorkflowId:'OgDZNSAvKEvhnAvn',active:true}),
 Object.freeze({workflowId:'OgDZNSAvKEvhnAvn',type:'n8n',via:'httpRequest',rpc:'qa_shop_b_zalo_claim',active:true})
]);
const FIELDS=['name','securityDefiner','anonExecute','authenticatedExecute','authUidCheck','vaultHeaderGuard','storeAware','mutationRisk','scope'];
const safeId=v=>typeof v==='string'&&/^[a-z][a-z0-9_]{2,63}$/.test(v);
const dedup=x=>Object.freeze([...new Set(x)]);
export function inspectRpcSurface(input=[]){
 const blockers=[];
 if(!Array.isArray(input))return Object.freeze({status:'REVIEW_REQUIRED',blockers:['INVALID_RPC_METADATA'],canRevoke:false,canDeploy:false});
 const names=new Set();
 for(const row of input){
  if(!row||typeof row!=='object'||!safeId(row.name)||names.has(row.name)){
   blockers.push('MALFORMED_OR_DUPLICATE_RPC');continue;
  }
  names.add(row.name);
  if(FIELDS.some(k=>!Object.hasOwn(row,k)))blockers.push('INCOMPLETE_METADATA_'+row.name);
  if(row.securityDefiner===true&&row.anonExecute===true){
    blockers.push('ANON_SECURITY_DEFINER_REVIEW_'+row.name);
    if(row.vaultHeaderGuard!==true)blockers.push('PUBLIC_PRIVILEGED_RPC_NO_KNOWN_GATE_'+row.name);
  }
  if(row.securityDefiner===true&&row.mutationRisk===true)
    blockers.push('PRIVILEGED_MUTATION_CALLER_AUDIT_'+row.name);
  if(row.scope==='TENANT_ONLY'&&row.storeAware!==true)
    blockers.push('STORE_AUTHORITY_GAP_'+row.name);
 }
 for(const exp of EXPECTED_RPC_METADATA)
  if(!names.has(exp.name))blockers.push('EXPECTED_RPC_MISSING_'+exp.name);
 return Object.freeze({
  status:'REVIEW_REQUIRED',blockers:dedup(blockers),
  publishedCallerEvidence:'BOUNDED_N8N_GRAPH_REVIEW_ONLY',
  cryptographicProviderSourceVerified:false,
  realMerchantOwnerVerified:false,
  canRevoke:false,canChangeRole:false,canRunRpc:false,canMigrate:false,canSend:false,canDeploy:false
 });
}
export function inspectCallerChain(chain=[],rpc='qa_shop_b_zalo_claim'){
 const blockers=[];
 if(!Array.isArray(chain))blockers.push('INVALID_CALLER_CHAIN');
 const a=Array.isArray(chain)?chain:[];
 const direct=a.filter(x=>x?.rpc===rpc&&x?.via==='httpRequest'&&x?.active===true);
 const parent=a.filter(x=>x?.targetWorkflowId==='OgDZNSAvKEvhnAvn'&&x?.via==='executeWorkflow'&&x?.active===true);
 if(direct.length===0)blockers.push('KNOWN_PUBLISHED_RPC_CALLER_NOT_CONFIRMED');
 if(parent.length===0)blockers.push('PARENT_WORKFLOW_LINK_NOT_CONFIRMED');
 if(direct.some(x=>x.workflowId!=='OgDZNSAvKEvhnAvn'))blockers.push('UNKNOWN_DIRECT_CALLER_REVIEW_REQUIRED');
 return Object.freeze({status:'NO_REVOKE_WITHOUT_CALLER_REVIEW',boundedDirectCount:direct.length,boundedParentCount:parent.length,blockers:dedup(blockers),callerInventoryExhaustive:false,nativeProviderSignatureVerified:false,canRevoke:false,canEnableWrite:false,canDeploy:false});
}
export const REAL_JWT_UAT_CASES=Object.freeze([
 ['QA01','A reads only A same-tenant order','ALLOW_IF_VERIFIED'],
 ['QA02','B reads only B same-tenant order','ALLOW_IF_VERIFIED'],
 ['QA03','A reads B order in same tenant','DENY'],
 ['QA04','B reads A order in same tenant','DENY'],
 ['QA05','A reads foreign-tenant order','DENY'],
 ['QA06','revoked A session','DENY'],
 ['QA07','expired B session','DENY'],
 ['QA08','inactive store membership','DENY'],
 ['QA09','forged user_metadata store role','DENY'],
 ['QA10','client supplied store_id override','DENY'],
 ['QA11','cross-customer order enumeration','DENY'],
 ['QA12','Messenger ID without verified Zalo pairing','DENY'],
 ['QA13','replayed challenge or provider event','DENY'],
 ['QA14','fake provider signature','DENY'],
 ['QA15','different provider installation under same tenant','DENY'],
 ['QA16','INSERT UPDATE DELETE or outbound provider send','DENY']
]);
export function inspectRealJwtAdmission(input={}){
 const blockers=[];
 if(input?.testMode!=='NO_SEND_READ_ONLY')blockers.push('ONLY_READ_ONLY_NO_SEND');
 if(input?.ownerApproval!=='PRIVATE_EXTERNAL_VERIFIER_REQUIRED')blockers.push('NO_INDEPENDENT_OWNER_APPROVAL');
 if(input?.m0Status!=='NOT_ACCEPTED')blockers.push('M0_STATUS_MUST_REMAIN_NOT_ACCEPTED_IN_PUBLIC_CI');
 const forbidden=['jwt','access_token','refresh_token','service_role','raw_provider_event','phone','merchant_document','raw_signature','store_id','user_metadata','customer_data'];
 if(input&&typeof input==='object'&&forbidden.some(k=>Object.hasOwn(input,k)))blockers.push('PRIVATE_CREDENTIAL_OR_CLIENT_CLAIM_REJECTED');
 blockers.push('REAL_AUTH_SIGNATURE_AND_SESSION_NOT_VERIFIED');
 blockers.push('SAME_TENANT_CANONICAL_STORES_NOT_PROVISIONED');
 blockers.push('PRIMARY_OWNER_EVIDENCE_NOT_INDEPENDENTLY_ADMITTED');
 return Object.freeze({status:'HOSTED_NO_GO',blockers:dedup(blockers),testCaseCount:REAL_JWT_UAT_CASES.length,realJwtVerified:false,realStoreABVerified:false,realProviderVerified:false,canRunHosted:false,canReadOrder:false,canSend:false,canRevokeRpc:false,canWrite:false,canDeploy:false});
}
