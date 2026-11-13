// Read only chatInput / turns_json supplied by the corpus parser. Emit aggregate counts only.
const {respond}=require('./engine.cjs');
const fs=require('node:fs'),assert=require('node:assert/strict');
const cases=JSON.parse(fs.readFileSync(0,'utf8'));
let messages=0;
for(const item of cases){
  let state={};
  for(const text of item.turns){
    const result=respond('fashion',state,text);
    assert.ok(result.reply.length && result.reply.length<=512);
    assert.ok(Object.keys(result.state).every(k=>['pending','sku'].includes(k)));
    if(result.facts.sku) assert.ok(['F01','F02'].includes(result.facts.sku));
    if(item.id==='QA05') assert.equal(result.kind,'missing');
    state=result.state; messages++;
  }
}
console.log(JSON.stringify({cases:cases.length,messages,scope:'bounded response, fixture SKU, minimal session fields, QA05 unknown SKU'}));
