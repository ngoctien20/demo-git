'use strict';
// Customer Catalog V12.4R.3 — PostgreSQL role-verified QA port.
// This is an opt-in repository, NOT automatically wired into any published channel or hosted DB.
// It must receive a transaction-owned client from the server-side session port.
const {isVerifiedCustomer}=require('./ingress.cjs');
const {createPostgresQaCatalog}=require('./catalog.cjs');
const trustedRole=/^(?:core_qa_[a-z0-9_]{1,32}|tien404_customer_[a-z0-9_]{1,32}_ro)$/;
const statement=`
  SELECT current_user AS role_name,
    (SELECT rolbypassrls FROM pg_roles WHERE rolname=current_user) AS bypass_rls,
    (SELECT rolsuper FROM pg_roles WHERE rolname=current_user) AS is_superuser,
    row_security_active('tien404_r1_qa.catalog'::regclass) AS catalog_rls_active,
    row_security_active('tien404_r1_qa.shop_bots'::regclass) AS bot_rls_active,
    has_column_privilege(current_user,'tien404_r1_qa.shop_bots'::regclass,'credential_ref','SELECT') AS can_read_credential_ref,
    has_column_privilege(current_user,'tien404_r1_qa.shop_bots'::regclass,'catalog_source_ref','SELECT') AS can_read_catalog_source_ref,
    has_table_privilege(current_user,'tien404_r1_qa.shop_bots'::regclass,'INSERT') AS can_insert_bot,
    has_table_privilege(current_user,'tien404_r1_qa.shop_bots'::regclass,'UPDATE') AS can_update_bot,
    has_table_privilege(current_user,'tien404_r1_qa.shop_bots'::regclass,'DELETE') AS can_delete_bot,
    has_table_privilege(current_user,'tien404_r1_qa.catalog'::regclass,'INSERT') AS can_insert_catalog,
    has_table_privilege(current_user,'tien404_r1_qa.catalog'::regclass,'UPDATE') AS can_update_catalog,
    has_table_privilege(current_user,'tien404_r1_qa.catalog'::regclass,'DELETE') AS can_delete_catalog`;

function createRlsEnforcedQaCatalog({roleForContext}={}){
  if(typeof roleForContext!=='function')throw Error('CATALOG_ROLE_MAPPER_REQUIRED');
  // Base reader takes an already-validated customer context and a transactional DB client.
  // Never fall back to a global privileged connection.
  const repository=createPostgresQaCatalog({poolForContext:()=>{throw Error('CATALOG_CLIENT_REQUIRED')}});
  return Object.freeze({async readProduct({context,sku,client}={}){
    if(!isVerifiedCustomer(context) || !client || typeof client.query!=='function')
      throw Error('CATALOG_TRUSTED_SESSION_REQUIRED');
    const expected=roleForContext(context);
    if(typeof expected!=='string'||!trustedRole.test(expected))throw Error('CATALOG_ROLE_UNAPPROVED');
    const check=await client.query(statement);
    if(check.rowCount!==1 || !check.rows?.[0])throw Error('CATALOG_ROLE_UNVERIFIED');
    const row=check.rows[0];
    if(row.role_name!==expected || row.bypass_rls!==false || row.is_superuser!==false ||
       row.catalog_rls_active!==true || row.bot_rls_active!==true ||
       row.can_read_credential_ref!==false || row.can_read_catalog_source_ref!==false ||
       row.can_insert_bot!==false || row.can_update_bot!==false || row.can_delete_bot!==false ||
       row.can_insert_catalog!==false ||
       row.can_update_catalog!==false || row.can_delete_catalog!==false)
      throw Error('CATALOG_ROLE_UNSAFE');
    const item=await repository.readProduct({context,sku,client});
    if(item && (item.tenantId!==context.tenantId || item.storeId!==context.storeId ||
      item.sku!==sku || item.source!=='QA_BACKEND_READBACK'))throw Error('CATALOG_CROSS_SCOPE_REJECTED');
    return item;
  },kind:'TRANSACTIONAL_QA_RLS_ENFORCED_NOT_HOSTED'});
}
module.exports={createRlsEnforcedQaCatalog};
