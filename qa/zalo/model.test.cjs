const test=require('node:test'),assert=require('node:assert/strict');
const {consult}=require('./model.cjs');
const ask=fn=>consult('fashion',{},'mẫu nào hợp nhỉ',['F01','D01'],fn,15);
test('untrusted proposals never set a SKU or quote',async()=>{
  const base=await ask();
  for(const fn of [()=>({sku:'D01'}),()=>({sku:'F01',price:1}),()=>{throw Error();},()=>new Promise(()=>{})])
    assert.deepEqual(await ask(fn),base);
  const r=await ask(()=>({sku:'F01'}));assert.match(r.reply,/phải không/);assert.deepEqual(r.state,{});
});
