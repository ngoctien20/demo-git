const {test}=require('node:test'),a=require('node:assert/strict');
const {mkdtempSync,rmSync}=require('node:fs'),{tmpdir}=require('node:os'),{join}=require('node:path');
const {openBridge}=require('./bridge.cjs');
test('V1 contract → persistent turns → allowlisted outbox → bounded mock delivery',t=>{
 const dir=mkdtempSync(join(tmpdir(),'v22-')),path=join(dir,'lab.db');
 t.after(()=>rmSync(dir,{recursive:true,force:true}));
 let b=openBridge(path);
 const fixture={stage:'READ_ONLY',accepted:true,eventName:'message.text.received',chatType:'PRIVATE',chatId:'qa-owner',messageId:'qa-one',text:'Áo đen'};
 const ask=(patch)=>b.receive({...fixture,...patch});
 a.equal(ask({accepted:false}).kind,'unsupported');
 a.equal(ask({chatType:'GROUP'}).kind,'unsupported');
 a.equal(ask({chatId:'qa-stranger'}).kind,'recipient_denied');
 a.equal(ask({messageId:12}).kind,'bad_event');
 a.equal(ask({text:' '}).kind,'bad_text');
 a.equal(ask({}).kind,'size');
 b.close();b=openBridge(path);
 a.equal(ask({}).kind,'duplicate');
 a.equal(ask({messageId:'qa-two',text:'size L'}).facts.price,159000);
 a.equal(ask({messageId:'qa-three',text:'Lấy 2'}).facts.total,318000);
 a.equal(ask({messageId:'qa-four',text:'không mua 2 nhé'}).kind,'cancel');
 const policy={enabled:true,limit:2};
 a.equal(b.dispatch('qa-one',{},200),'disabled');
 a.equal(b.dispatch('qa-one',policy,'timeout'),'needs_review');
 b.close();b=openBridge(path);
 a.equal(b.dispatch('qa-one',policy,200),'blocked');
 a.equal(b.dispatch('qa-two',policy,429),'rate_limited');
 a.equal(b.dispatch('qa-three',policy,200),'blocked');
 a.equal(b.dispatch('qa-three',{enabled:true,limit:3},200),'mock_accepted');
 a.equal(b.dispatch('qa-three',{enabled:true,limit:4},200),'blocked');
 b.close();
});
test('two workers share one event and one dispatch reservation',async t=>{
 const {Worker}=require('node:worker_threads');
 const dir=mkdtempSync(join(tmpdir(),'v22-race-')),path=join(dir,'lab.db');
 t.after(()=>rmSync(dir,{recursive:true,force:true}));
 openBridge(path).close();
 async function race(op) {
   const workers=Array.from({length:2},()=>new Worker(`
     const {parentPort,workerData:w}=require('node:worker_threads');
     const b=require(w.mod).openBridge(w.path);
     parentPort.once('message',()=>{
       const value=w.op==='receive' ? b.receive({stage:'READ_ONLY',accepted:true,eventName:'message.text.received',chatType:'PRIVATE',chatId:'qa-owner',messageId:'qa-race',text:'F01'}).kind : b.dispatch('qa-race',{enabled:true,limit:1},200);
       b.close();parentPort.postMessage(value);
     });
     parentPort.postMessage('ready');`,{eval:true,workerData:{mod:require.resolve('./bridge.cjs'),path,op}}));
   const next=w=>new Promise((resolve,reject)=>{w.once('message',resolve);w.once('error',reject);});
   await Promise.all(workers.map(next));
   const result=Promise.all(workers.map(next));workers.forEach(w=>w.postMessage('go'));return (await result).sort();
 }
 a.deepEqual(await race('receive'),['catalog','duplicate']);
 a.deepEqual(await race('dispatch'),['blocked','mock_accepted']);
});
