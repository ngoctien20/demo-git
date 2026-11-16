'use strict';
/** TIEN404 V15.0-10 — inspection-only fail-closed release gate.
 * Inputs are catalog observations, never authorization or JWT proof.
 */
const REQUIRED_SCOPED=Object.freeze(['orders','order_items','products','conversations','messages']);
const REQUIRED_TABLES=Object.freeze(['stores','store_memberships']);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function auditHostedShape({tables=[],columns=[],policies=[],constraints=[]}={}){
 const tableSet=new Set(tables.map(x=>typeof x==='string'?x:x?.table_name).filter(Boolean));
 const colSet=new Set(columns.filter(x=>x&&typeof x.table_name==='string'&&typeof x.column_name==='string').map(x=>x.table_name+'.'+x.column_name));
 const findings=[];
 for(const t of REQUIRED_TABLES)if(!tableSet.has(t))findings.push('MISSING_PUBLIC_'+t.toUpperCase());
 for(const t of REQUIRED_SCOPED)if(!colSet.has(t+'.store_id'))findings.push('MISSING_STORE_SCOPE_'+t.toUpperCase());
 for(const t of ['orders','products']){
  const match=policies.some(x=>x?.tablename===t&&x?.cmd==='SELECT'&&x?.permissive==='RESTRICTIVE'&&/store/i.test(x.policyname||''));
  if(!match)findings.push('MISSING_RESTRICTIVE_STORE_POLICY_'+t.toUpperCase());
 }
 const fk=constraints.filter(x=>x?.table_name==='order_items'&&/FOREIGN KEY\s*\(\s*tenant_id\s*,\s*store_id\s*,\s*(?:order_id|product_id)\s*\)/i.test(x?.constraint_def||''));
 if(fk.length<2)findings.push('MISSING_ORDER_ITEMS_TENANT_STORE_FKS');
 return Object.freeze({version:'V15.0-10',status:findings.length?'BLOCKED':'SCHEMA_REVIEW_ONLY_NOT_CERTIFIED',
  findings:Object.freeze(findings),hosted_jwt_certified:false,owner_g23_certified:false,backup_restored_hosted:false,
  migration_authorized:false,provider_send_authorized:false,sample_ids_are_synthetic:true});
}
function verifyPrivateMatrixInputs({actors,orders}={}){
 if(!actors||!orders)return 'PRIVATE_FIXTURE_INPUT_REQUIRED';
 const tokens=['A','B','C'].map(k=>actors[k]?.token);
 if(tokens.some(t=>typeof t!=='string'||t.length<12)||new Set(tokens).size!==3)return 'THREE_DISTINCT_PRIVATE_JWT_REQUIRED';
 const users=['A','B','C'].map(k=>actors[k]?.expectedUserId);
 if(users.some(x=>!UUID.test(x||''))||new Set(users).size!==3)return 'INDEPENDENT_ACTOR_IDS_REQUIRED';
 const stores=['A','B','C'].map(k=>orders[k]?.store_id);
 if(stores.some(x=>!UUID.test(x||''))||new Set(stores).size!==3)return 'THREE_DISTINCT_STORE_IDS_REQUIRED';
 const ordersIds=['A','B','C'].map(k=>orders[k]?.order_id);
 if(ordersIds.some(x=>!UUID.test(x||''))||new Set(ordersIds).size!==3)return 'THREE_PERSISTED_QA_ORDER_IDS_REQUIRED';
 if(orders.A?.tenant_id!==orders.B?.tenant_id||orders.A?.tenant_id===orders.C?.tenant_id||
  ['A','B','C'].some(k=>!UUID.test(orders[k]?.tenant_id||'')))return 'SAME_TENANT_AB_AND_CROSS_TENANT_C_REQUIRED';
 return null;
}
module.exports={auditHostedShape,verifyPrivateMatrixInputs};
