'use strict';
/**
 * TIEN404 V13.6M.5 — Test-only simulated PostgreSQL UNIQUE + transaction
 * coordinator. Retains a Map between model clients, NOT across process restart.
 * NOT a DB connection or evidence of PostgreSQL ACID, RLS or durability.
 */
const {SQL}=require('./private-event-store.cjs');
const fail=code=>{const e=new Error(code);e.code=code;throw e};
function createSyntheticPgModel(){
 let table=new Map(),tail=Promise.resolve(),rollbackNext=false,transactions=0;
 const entryKey=v=>v.slice(0,6).join('|');
 function openClient(){
  return Object.freeze({
   synthetic:true,externalWrites:false,
   profile:'SYNTHETIC_PRIVATE_PG_TRANSACTION_MODEL',
   async transaction(callback){
    if(typeof callback!=='function')fail('TEST_TRANSACTION_INVALID');
    const pending=tail.then(async()=>{
     const draft=new Map([...table].map(([k,v])=>[k,{...v}]));
     const tx=Object.freeze({
      async query(sql,values){
       if(!Array.isArray(values))fail('TEST_QUERY_PARAMS_REQUIRED');
       const key=entryKey(values);
       if(sql===SQL.claim){
        if(values.length!==9)fail('TEST_CLAIM_PARAMS_INVALID');
        if(draft.has(key))return {rows:[]};
        draft.set(key,{status:'CLAIMED',lease:values[6],
         claimedAt:values[7],expiresAt:values[8]});
        return {rows:[{lease_id:values[6],status:'CLAIMED'}]};
       }
       if(sql===SQL.finalize){
        if(values.length!==9)fail('TEST_FINALIZE_PARAMS_INVALID');
        const x=draft.get(key);
        if(!x||x.status!=='CLAIMED'||x.lease!==values[6])
          return {rows:[]};
        x.status=values[7];x.completedAt=values[8];
        return {rows:[{lease_id:values[6],status:x.status}]};
       }
       fail('TEST_UNKNOWN_SQL_DENIED');
      }
     });
     const result=await callback(tx);
     if(rollbackNext){rollbackNext=false;fail('TEST_TRANSACTION_ROLLED_BACK')}
     table=draft;transactions++;
     return result;
    });
    tail=pending.catch(()=>{});
    return pending;
   }
  });
 }
 return Object.freeze({
  openClient,
  injectRollbackOnce:()=>{rollbackNext=true},
  // Only operational counters. Never disclose PSID, hashed identities or receipts.
  diagnostics:()=>Object.freeze({model:'IN_MEMORY_SHARED_TRANSACTION_SIMULATOR',
   rowCount:table.size,transactions,realPostgres:false,
   durableAcrossProcessRestart:false,providerSendEnabled:false,
   externalWrites:false}),
  // Source-only synthetic crash/failure diagnostics, never a production worker.
  simulatedStatuses:()=>[...table.values()].map(x=>x.status).sort()
 });
}
module.exports={createSyntheticPgModel};
