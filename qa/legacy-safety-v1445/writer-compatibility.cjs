'use strict';
/**
 * TIEN404 V14.4.5 — legacy Product Writer compatibility and routing AUDIT.
 * No RPC invocation, no n8n execution, no SQL, no network, no credentials.
 * A positive finding is an offline classification, NEVER deployment authority.
 */
const EXPECTED={
 'KrSn4DNR9ALX5ng4':{name:'Create Order Tool (AI_SALES_DEMO)',active:true,backing:'GOOGLE_SHEETS_DEMO',published:'4740251a-cd01-4f7f-b8e1-e300a8393151',draft:'af9ee686-2a9f-483e-9622-6e449500ac5e',steps:['Read Products','Read Orders','Validate Order','Append Order']},
 'fDB9dvs1qPPVt9Sp':{name:'AI SALES - Manage Order',active:true,backing:'GOOGLE_SHEETS_DEMO',published:'137d5689-40c5-4147-9bbc-b22809ad5908',draft:'2e8786fd-e5c5-410f-9d6c-655653c32278',steps:['Validate Change','Update Order Row','Read Back Order']},
 'BkAi6TVUKAjCnI7v':{name:'AI SALES - Update Order.',active:true,backing:'GOOGLE_SHEETS_DEMO',published:'93cf227a-ab8a-42c6-9185-7ec44f7aeb00',draft:'3bd7043f-78e7-4a1c-93e5-2bc9d60ac767',steps:['Validate Address Update','Update row in sheet','Verify Updated Order']},
 'U2DJsxzSYPH5hRop':{name:'AI SALES - Revenue Report',active:true,backing:'GOOGLE_SHEETS_DEMO',published:'978b5a8d-d47b-4783-b27e-96fbc96d5262',draft:'e4e16b90-1c66-48b9-a9e0-9d8fb6dbc6df',steps:['Get row(s) in sheet','Code in JavaScript']},
 'Y0WLykMtNAldbgL0':{name:'TIEN404_COMMERCE_V3_BUSINESS_CORE_SANDBOX',active:true,backing:'N8N_DATA_TABLES_SANDBOX',published:'3d8b7f89-2058-4a2a-8919-e5ff92c3c484',draft:'3d8b7f89-2058-4a2a-8919-e5ff92c3c484',steps:['Read V3 Product Snapshot','Read V3 Price Rules','Business Rules Decision V3']},
 'igPOsSbEgd4NgtRA':{name:'TIEN404_COMMERCE_CART_PREVIEW',active:true,backing:'N8N_DATA_TABLES_SANDBOX',published:'eff32e20-a6d0-4975-88b8-107eae752b4b',draft:'eff32e20-a6d0-4975-88b8-107eae752b4b',steps:['Read Cart Catalog','Validate and Preview Cart']}
};
const LEGACY_RPC=Object.freeze({name:'public.save_merchant_product',result:'timestamp with time zone',
 signature:['p_tenant uuid','p_sku text','p_name text','p_price bigint','p_active boolean','p_initial_stock integer','p_expected_updated_at timestamp with time zone'],
 identity:'TENANT_SKU_ONLY',grant:'AUTHENTICATED',isDefiner:true,storeScoped:false,
 environment:'HOSTED_STAGING_EXISTING_DO_NOT_MODIFY'});
const EXPECTED_IDS=Object.freeze(Object.keys(EXPECTED));
function reportWorkflowInventory(workflows){
 const problems=[];
 if(!Array.isArray(workflows)||workflows.length!==EXPECTED_IDS.length)
  problems.push('WORKFLOW_INVENTORY_INCOMPLETE');
 const map=new Map();
 for(const w of Array.isArray(workflows)?workflows:[]){
  if(!w||typeof w.id!=='string'||map.has(w.id))problems.push('MISSING_OR_DUPLICATE_WORKFLOW_ID');
  else map.set(w.id,w);
 }
 const rows=EXPECTED_IDS.map(id=>{
  const expected=EXPECTED[id],w=map.get(id);
  const deviations=[];
  if(!w){deviations.push('WORKFLOW_NOT_FOUND');}
  else{
   if(w.name!==expected.name)deviations.push('WORKFLOW_NAME_CHANGED');
   if(w.active!==expected.active)deviations.push('WORKFLOW_ACTIVATION_CHANGED');
   if(w.versionId!==expected.draft)deviations.push('DRAFT_VERSION_DRIFT');
   if(w.activeVersionId!==expected.published)deviations.push('PUBLISHED_VERSION_DRIFT');
   if(!Array.isArray(w.nodeNames)||expected.steps.some(n=>!w.nodeNames.includes(n)))
    deviations.push('REQUIRED_NODE_MISSING_OR_RENAMED');
   // We deliberately refuse to infer actual DB store or data ownership
   // from node names alone. Backing is an as-of audit classification.
  }
  return Object.freeze({workflowId:id,backing:expected.backing,
   publishedAndDraftDiffer:expected.draft!==expected.published,
   deviations:Object.freeze(deviations),currentlyHostReady:false});
 });
 if(rows.some(x=>x.deviations.length))problems.push('SNAPSHOT_DRIFT_REAUDIT_REQUIRED');
 return Object.freeze({status:problems.length?'MANIFEST_REAUDIT_REQUIRED':'READ_ONLY_AUDIT_SNAPSHOT_MATCH',
  rows:Object.freeze(rows),blockers:Object.freeze([...new Set(problems)]),
  activeWorkflowWritesPermitted:false,canPublish:false,canConnectV2:false,
  noStoreAuthorityVerified:true});
}
function assessLegacyProductCall({channel,operation,tenantId,storeId,
 expectedVersion,source,scopeCount,requestFields}={}){
 const reasons=[];
 if(source!=='SERVER_VERIFIED_LEGACY_ROUTE')reasons.push('UNTRUSTED_ROUTE_SOURCE');
 if(!['read','write'].includes(operation))reasons.push('UNKNOWN_OPERATION');
 if(typeof tenantId!=='string'||tenantId.length<12)reasons.push('TENANT_SCOPE_MISSING');
 if(channel!=='AI_SALES_DEMO')reasons.push('LEGACY_CHANNEL_MUST_REMAIN_DEMO');
 if(storeId!==undefined&&storeId!==null)reasons.push('LEGACY_STORE_SCOPE_UNSUPPORTED');
 if(scopeCount!==1)reasons.push('SINGLE_LEGACY_TENANT_SCOPE_NOT_PROVEN');
 if(expectedVersion!=='CURRENT_VERIFIED_LEGACY_VERSION')
  reasons.push('LEGACY_COMPAT_VERSION_UNVERIFIED');
 if(requestFields&&Object.keys(requestFields).some(k=>
   /^(?:store_id|storeId|tenant_override|client_role|actor_override|stock_adjustment|service_role)$/i.test(k)))
   reasons.push('LEGACY_CLIENT_SCOPE_OR_STOCK_OVERRIDE');
 // Even clean source classification is NOT authority to invoke a writer.
 return Object.freeze({mode:'SOURCE_ONLY_LEGACY_COMPATIBILITY_REVIEW',
   state:reasons.length?'MUST_NOT_ROUTE':'DEMO_ONLY_COMPATIBILITY_CANDIDATE',
   blockers:Object.freeze(reasons),eligibleForMultiStore:false,
   eligibleForCommerceV2:false,canCallLegacyRpc:false,canCallV2Rpc:false,
   canWriteHosted:false,canChangeStock:false,canPublishWorkflow:false});
}
function assessProductV2Bridge({legacy,storeV2,authServer,qa}={}){
 const blockers=[];
 if(!legacy||legacy.storeScoped!==false||legacy.identity!=='TENANT_SKU_ONLY')
  blockers.push('LEGACY_CONTRACT_UNVERIFIED');
 if(!storeV2||storeV2.scopedIdentity!=='TENANT_STORE_SKU'||storeV2.cas!==true||
    storeV2.priceIntegerVnd!==true||storeV2.stockMetadataSeparated!==true)
  blockers.push('V2_COMPAT_CONTRACT_UNVERIFIED');
 if(!authServer||authServer.realJwtVerified!==true||
    authServer.storeMembershipEnforced!==true)
  blockers.push('REAL_STORE_AUTH_NOT_PROVEN');
 if(!qa||qa.sameTenantStoreIsolation!==true||qa.publishedCallerParity!==true)
  blockers.push('CALLER_PARITY_OR_RLS_NOT_PROVEN');
 blockers.push('BACKUP_RESTORE_AND_OWNER_MAPPING_REQUIRED');
 return Object.freeze({status:'MIGRATION_NOT_AUTHORIZED',
  blockers:Object.freeze(blockers),legacyRpcPreserved:true,
  legacyCallerRewriteAllowed:false,hostedForwardAllowed:false,
  canChangeStoreSchema:false,canUpdateProducts:false,canChangeBilling:false});
}
module.exports={LEGACY_RPC,EXPECTED_IDS,EXPECTED,reportWorkflowInventory,
  assessLegacyProductCall,assessProductV2Bridge};
