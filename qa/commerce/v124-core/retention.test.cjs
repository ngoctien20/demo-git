'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createQaRetentionMaintenance}=require('./postgres/retention.cjs');

test('Retention maintenance is not a public core route or a scheduled job',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const api=fs.readFileSync(path.join(__dirname,'index.cjs'),'utf8');
 const source=fs.readFileSync(path.join(__dirname,'postgres/retention.cjs'),'utf8');
 assert.ok(!api.includes('retention.cjs'));
 assert.ok(!source.includes('SECURITY DEFINER'));
 assert.ok(!source.includes('public.orders'));
 assert.ok(!source.includes('httpRequest'));
 const port=createQaRetentionMaintenance({pool:{connect:async()=>{throw Error('SHOULD_NOT_CONNECT')}}});
 assert.equal(port.mode,'NOT_SCHEDULED_QA_CANDIDATE');
});
test('Reject unsafe or short session retention, unbounded batch, missing pool',()=>{
 assert.throws(()=>createQaRetentionMaintenance(),/RETENTION_POOL_REQUIRED/);
 const pool={connect:async()=>({})};
 for(const sessionRetentionMs of [1,3600000,NaN,Infinity,31*86400000])
  assert.throws(()=>createQaRetentionMaintenance({pool,sessionRetentionMs}),/RETENTION_POLICY_INVALID/);
 for(const batchSize of [0,251,-1,Infinity,2.2])
  assert.throws(()=>createQaRetentionMaintenance({pool,batchSize}),/RETENTION_POLICY_INVALID/);
 for(const receiptGraceMs of [1,120001.2,-1,86400001])
  assert.throws(()=>createQaRetentionMaintenance({pool,receiptGraceMs}),/RETENTION_POLICY_INVALID/);
});
test('Database inspection is read-only, parameterized and returns aggregate counts only',async()=>{
 const trace=[],client={async query(sql,values=[]){
   trace.push({sql,values});
   if(sql.startsWith('SELECT current_database()'))return {rows:[{database_name:'tien404_core_ephemeral',stale_sessions:5,stale_receipts:8}]};
   return {rows:[]};
 },release:()=>{trace.push({sql:'RELEASE'})}};
 const m=createQaRetentionMaintenance({pool:{connect:async()=>client},batchSize:17});
 const info=await m.inspect();
 assert.equal(info.mode,'READ_ONLY_RETENTION_INSPECTION');
 assert.equal(info.staleSessions,5);assert.equal(info.staleReceipts,8);
 assert.deepEqual(trace.filter(x=>x.sql.includes('SELECT current_database()')).map(x=>x.values),[[86400000,300000]]);
 assert.equal(trace[0].sql,'BEGIN READ ONLY');
 assert.ok(trace.some(x=>x.sql==='COMMIT'));
 assert.ok(!trace.some(x=>/DELETE FROM|UPDATE |INSERT INTO/.test(x.sql)));
 assert.ok(!JSON.stringify(info).includes('actor_hash'));
});
test('Cannot delete on staging, production or unknown DB, even when caller requests it',async()=>{
 let connections=0;
 const pool={connect:async()=>{connections++;throw Error('NEVER_CONNECT')}};
 const m=createQaRetentionMaintenance({pool});
 const prev=Object.fromEntries(['PGHOST','PGDATABASE','TIEN404_EPHEMERAL_PG'].map(k=>[k,process.env[k]]));
 try {
   process.env.TIEN404_EPHEMERAL_PG='yes';
   process.env.PGHOST='aws-0-ap-southeast-1.pooler.supabase.com';
   process.env.PGDATABASE='postgres';
   await assert.rejects(m.sweepDisposableQaOnly(),/RETENTION_LIVE_DELETE_FORBIDDEN/);
   process.env.PGHOST='127.0.0.1';process.env.PGDATABASE='postgres';
   await assert.rejects(m.sweepDisposableQaOnly(),/RETENTION_LIVE_DELETE_FORBIDDEN/);
   process.env.TIEN404_EPHEMERAL_PG='no';process.env.PGDATABASE='tien404_core_ephemeral';
   await assert.rejects(m.sweepDisposableQaOnly(),/RETENTION_LIVE_DELETE_FORBIDDEN/);
   assert.equal(connections,0);
 } finally {for(const [k,v] of Object.entries(prev)){if(v===undefined)delete process.env[k];else process.env[k]=v}}
});
