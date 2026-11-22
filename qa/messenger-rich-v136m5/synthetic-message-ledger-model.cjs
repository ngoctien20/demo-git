'use strict';
/**
 * Transactional in-memory simulation of PG17 messenger_send_plans/parts.
 * NOT PostgreSQL, durable, hosted, Meta transport, or proof of RLS.
 */
const {SQL}=require('./message-attempt-ledger.cjs');
function createSyntheticMessageLedgerModel(){
 let plans=new Map(),parts=new Map(),tail=Promise.resolve(),rollback=false;
 let transactions=0;
 function client(){
  return Object.freeze({
   synthetic:true,externalWrites:false,
   profile:'SYNTHETIC_MESSENGER_OUTBOX_TRANSACTION_MODEL',
   async transaction(fn){
    if(typeof fn!=='function')throw Error('LEDGER_MODEL_TRANSACTION_REQUIRED');
    const pending=tail.then(async()=>{
     const p=new Map([...plans].map(([k,v])=>[k,{...v}]));
     const q=new Map([...parts].map(([k,v])=>[k,{...v}]));
     const scope=v=>v.slice(1,7).join('|');
     const partKey=(id,n)=>id+'|'+n;
     const tx={async query(sql,v){
      if(!Array.isArray(v))throw Error('LEDGER_MODEL_PARAMS_INVALID');
      if(sql===SQL.plan){
       if(v.length!==10||v[9].length!==v[8])throw Error('LEDGER_MODEL_PLAN_INVALID');
       const identity=scope(v);
       if([...p.values()].some(x=>x.scope===identity))return {rows:[]};
       p.set(v[0],{id:v[0],scope:identity,count:v[8],state:'PREPARED'});
       for(let n=1;n<=v[8];n++){
        q.set(partKey(v[0],n),{planId:v[0],index:n,
         bodyDigest:v[9][n-1],state:'PLANNED',attemptId:null,providerMid:null});
       }
       return {rows:[{plan_id:v[0],expected_count:v[8]}]};
      }
      if(sql===SQL.reserve){
       if(v.length!==4)throw Error('LEDGER_MODEL_RESERVE_INVALID');
       const plan=p.get(v[0]),part=q.get(partKey(v[0],v[1]));
       if(!part||!plan||plan.state!=='PREPARED'||part.state!=='PLANNED')
        return {rows:[]};
       part.state='MAY_HAVE_SENT_HOLD';part.attemptId=v[2];
       return {rows:[{attempt_id:v[2],status:part.state}]};
      }
      if(sql===SQL.accept){
       if(v.length!==5)throw Error('LEDGER_MODEL_ACCEPT_INVALID');
       const part=q.get(partKey(v[0],v[1]));
       if(!part||part.state!=='MAY_HAVE_SENT_HOLD'||part.attemptId!==v[2])
        return {rows:[]};
       if([...q.values()].some(x=>x.planId===v[0]&&x.providerMid===v[3]))
        throw Error('LEDGER_PROVIDER_MID_UNIQUE_CONFLICT');
       part.state='API_ACCEPTED_MOCK';part.providerMid=v[3];
       return {rows:[{attempt_id:v[2],status:part.state}]};
      }
      if(sql===SQL.uncertain){
       if(v.length!==4)throw Error('LEDGER_MODEL_UNCERTAIN_INVALID');
       const part=q.get(partKey(v[0],v[1]));
       if(!part||part.state!=='MAY_HAVE_SENT_HOLD'||part.attemptId!==v[2])
        return {rows:[]};
       part.state='UNCERTAIN_HOLD';
       return {rows:[{attempt_id:v[2],status:part.state}]};
      }
      if(sql===SQL.close){
       if(v.length!==2)throw Error('LEDGER_MODEL_CLOSE_INVALID');
       const plan=p.get(v[0]);
       if(!plan||plan.state!=='PREPARED')return {rows:[]};
       const all=[...q.values()].filter(x=>x.planId===v[0]);
       if(all.length!==plan.count||all.some(x=>x.state!=='API_ACCEPTED_MOCK'))
        return {rows:[]};
       plan.state='MOCK_PARTS_ACCEPTED';
       return {rows:[{plan_id:v[0],status:plan.state}]};
      }
      throw Error('LEDGER_MODEL_SQL_UNKNOWN');
     }};
     const result=await fn(tx);
     if(rollback){rollback=false;throw Error('LEDGER_MODEL_ROLLBACK')}
     plans=p;parts=q;transactions++;
     return result;
    });
    tail=pending.catch(()=>{});
    return pending;
   }
  });
 }
 return Object.freeze({
  client,
  rollbackNext:()=>{rollback=true},
  diagnostics:()=>Object.freeze({model:'IN_MEMORY_ONLY',
   plannedEvents:plans.size,parts:parts.size,transactions,
   statuses:[...parts.values()].map(x=>x.state).sort(),
   providerSendEnabled:false,externalWrites:false,durable:false})
 });
}
module.exports={createSyntheticMessageLedgerModel};
