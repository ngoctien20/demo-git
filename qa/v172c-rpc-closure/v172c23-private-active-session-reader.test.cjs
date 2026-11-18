'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createActiveSessionReader}=require('./v172c23-private-active-session-reader.cjs');
const a='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const b='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
test('only a parameterized private read of matching session + subject succeeds',async()=>{
 let got;
 const check=createActiveSessionReader({query:async(sql,params)=>{
  got={sql,params};return {rows:[{id:a,user_id:b}]};
 }});
 const out=await check({sessionId:a,subjectRef:b});
 assert.equal(out.active,true);
 assert.match(got.sql,/not_after IS NULL OR not_after > NOW/);
 assert.deepEqual(got.params,[a,b]);
 assert.equal(got.sql.includes(a),false);
});
test('denies absent session',async()=>{
 const check=createActiveSessionReader({query:async()=>({rows:[]})});
 assert.equal((await check({sessionId:a,subjectRef:b})).active,false);
});
test('denies mismatched row',async()=>{
 const check=createActiveSessionReader({query:async()=>({rows:[{id:a,user_id:a}]})});
 assert.equal((await check({sessionId:a,subjectRef:b})).active,false);
});
test('denies duplicate unexpected rows',async()=>{
 const check=createActiveSessionReader({query:async()=>({rows:[{id:a,user_id:b},{id:a,user_id:b}]})});
 assert.equal((await check({sessionId:a,subjectRef:b})).active,false);
});
test('rejects untrusted string before querying',async()=>{
 let calls=0;
 const check=createActiveSessionReader({query:async()=>{calls++;return {rows:[]}}});
 assert.equal((await check({sessionId:"' OR 1=1 --",subjectRef:b})).active,false);
 assert.equal(calls,0);
});
test('DB errors fail closed without disclosing internals',async()=>{
 const check=createActiveSessionReader({query:async()=>{throw Error('database private failure')}});
 assert.deepEqual(await check({sessionId:a,subjectRef:b}),{active:false});
});
test('requires private query dependency',()=>assert.throws(()=>createActiveSessionReader(),/MISSING_PRIVATE_SESSION_READER/));
