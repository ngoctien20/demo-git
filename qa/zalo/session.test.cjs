const test=require('node:test'), assert=require('node:assert/strict');
const {mkdtempSync,rmSync}=require('node:fs');
const {join}=require('node:path');
const {tmpdir}=require('node:os');
const {Worker}=require('node:worker_threads');
const {openLab,TTL}=require('./session.cjs');
test('Reopen, actor/tenant isolation, TTL and replay',t=>{
  const dir=mkdtempSync(join(tmpdir(),'zalo-')), path=join(dir,'sessions');
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  let lab=openLab(path);
  const turn=(tenant,actor,id,q,now)=>lab.turn(tenant,actor,id,q,now).kind;
  assert.equal(turn('fashion','qa-a','qa-1','áo đen',1),'size');
  lab.close(); lab=openLab(path);
  assert.equal(turn('fashion','qa-a','qa-1','size L',2),'duplicate');
  assert.equal(turn('fashion','qa-b','qa-1','size L',2),'clarify');
  assert.equal(turn('grocery','qa-a','qa-1','size L',2),'clarify');
  assert.equal(turn('fashion','qa-a','qa-2','size L',3),'catalog');
  assert.equal(turn('fashion','qa-a','qa-3','mua 2',3+TTL),'clarify');
  lab.close();
});
test('Concurrent workers accept one synthetic receipt',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'zalo-')), path=join(dir,'sessions');
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const lab=openLab(path);lab.close();
  const worker=()=>new Promise((resolve,reject)=>{
    const w=new Worker(`const {parentPort,workerData}=require('node:worker_threads');const lab=require(workerData.mod).openLab(workerData.path);parentPort.postMessage(lab.turn('fashion','qa-a','qa-event','F01').kind);lab.close();`,{eval:true,workerData:{path,mod:require.resolve('./session.cjs')}});
    w.on('message',resolve);w.on('error',reject);
  });
  assert.deepEqual((await Promise.all([worker(),worker()])).sort(),['catalog','duplicate']);
});
