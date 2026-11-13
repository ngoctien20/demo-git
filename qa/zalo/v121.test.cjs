const test=require('node:test'),a=require('node:assert/strict');
const {respond}=require('./engine.cjs'),{transition}=require('./memory-v22.cjs'),{ollamaInference}=require('./ollama.cjs');
const row={scope:'qa-owner-a',facts:'{"pending":"black"}',receipts:'[]',revision:3,expires:500};
const event={scope:row.scope,messageId:'qa-one',text:'size L'};
test('expiry, duplicate, scope, corrupt state and quota',()=>{
  const r=transition(row,event,1,respond);
  a.match(r.preview,/159.000/);a.equal(r.revision,4);a.deepEqual(transition(r,event,2,respond),{duplicate:true});
  a.doesNotMatch(transition(row,event,500,respond).preview,/159.000/);
  for(const patch of [{scope:'qa-owner-b'},{facts:'bad'},{receipts:'{}'},{receipts:JSON.stringify(Array.from({length:128},(_,i)=>['qa-'+i,999]))}])
    a.throws(()=>transition({...row,...patch},event,1,respond));
});
test('local HTTP adapter clamps tokens and validates provider response',async()=>{
  const payload={systemPrompt:'test',text:'QA',candidates:['F01']};
  const mock=(content,extra={})=>async(url,opts)=>{
    a.equal(url,'http://127.0.0.1:11434/api/chat');a.equal(opts.redirect,'error');a.equal(JSON.parse(opts.body).options.num_predict,48);
    return {ok:true,json:async()=>({done:true,message:{role:'assistant',content},eval_count:10,...extra})};
  };
  a.deepEqual(await ollamaInference('local',mock('{"sku":"F01"}'))(payload),{sku:'F01'});
  for(const fn of [mock('{"sku":"D01"}'),mock('{"sku":"F01","price":9}'),mock('{}',{eval_count:49})])
    await a.rejects(ollamaInference('local',fn)(payload));
});
