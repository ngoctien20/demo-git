'use strict';
// V12.4R.3 — opt-in, backend-only, owned-connection Catalog reader.
// Uses a per-shop *server configured* PG pool. Never runs SET ROLE, and never
// reads a client-supplied tenant/store value or accepts a borrowed DB client.
// Not exported by index.cjs; not connected to any live channel.
const {isVerifiedCustomer}=require('./ingress.cjs');
const {createRlsEnforcedQaCatalog}=require('./hosted-catalog-guard.cjs');
const allowedRole=/^(?:core_qa_[a-z0-9_]{1,32}|tien404_customer_[a-z0-9_]{1,32}_ro)$/;
const skuPattern=/^[A-Z]{1,4}\d{2,5}$/;

function createTransactionalQaCatalog({roleForContext,poolForContext}={}){
  if(typeof roleForContext!=='function'||typeof poolForContext!=='function')
    throw Error('CATALOG_TRUSTED_POOL_MAPPER_REQUIRED');

  return Object.freeze({kind:'OWNED_READ_ONLY_PG_TRANSACTION_QA_NOT_HOSTED',
    async readProduct({context,sku,client}={}){
      if(!isVerifiedCustomer(context)||typeof sku!=='string'||!skuPattern.test(sku))
        throw Error('CATALOG_TRUSTED_CONTEXT_REQUIRED');
      // A session/transaction owned by another port must never be silently
      // reused: the caller cannot prove its role or lock lifecycle here.
      if(client!=null)throw Error('CATALOG_EXTERNAL_CLIENT_FORBIDDEN');

      // Both lookups are server-owned mappings, independent of browser claims.
      const role=roleForContext(context);
      if(typeof role!=='string'||!allowedRole.test(role))
        throw Error('CATALOG_ROLE_UNAPPROVED');
      const pool=poolForContext(context);
      if(!pool||typeof pool.connect!=='function')
        throw Error('CATALOG_TRUSTED_POOL_REQUIRED');

      // The returned pg Client is leased exclusively until COMMIT/ROLLBACK.
      // The underlying role is preconfigured for this trusted pool; there is
      // no dynamic SET ROLE, SQL identifier interpolation, or credential lookup.
      const db=await pool.connect();
      let broken=false,started=false;
      try{
        await db.query('BEGIN READ ONLY');
        started=true;
        await db.query("SET LOCAL row_security = on");
        await db.query("SET LOCAL statement_timeout = '2s'");
        await db.query("SET LOCAL idle_in_transaction_session_timeout = '4s'");
        // Probe and product SELECT run on the very same leased connection.
        const gate=createRlsEnforcedQaCatalog({roleForContext:()=>role});
        const item=await gate.readProduct({context,sku,client:db});
        await db.query('COMMIT');
        return item;
      }catch(error){
        if(started){
          try{await db.query('ROLLBACK');}catch{broken=true;}
        }else{
          // An uncertain BEGIN is never safe to reuse.
          broken=true;
        }
        throw error;
      }finally{
        db.release(broken);
      }
    }});
}
module.exports={createTransactionalQaCatalog};
