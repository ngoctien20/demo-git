'use strict';
// Development-only ports. No channel, database, paid model or customer session is active.
const fail=code=>{const e=new Error(code);e.code=code;throw e;};
function createDisabledChannelAdapter(channel){
 if(!['zalo','messenger','website','telegram'].includes(channel))fail('UNKNOWN_CHANNEL');
 return Object.freeze({channel,state:'RESERVED_NOT_CONNECTED',send:async()=>fail('CHANNEL_OUTBOUND_DISABLED')});
}
function createBlockedPaidModelPort(){
 return Object.freeze({classify:async()=>fail('MODEL_COST_GATE_UNVERIFIED')});
}
function createFixtureIntentClassifier(){
 return Object.freeze({kind:'DETERMINISTIC_FIXTURE_NOT_LLM',async classify({text}){
  const s=String(text||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d');
  const sku=(s.match(/\b[a-z]{1,4}\d{2,5}\b/)||[])[0]?.toUpperCase()||'UNKNOWN';
  const m=s.match(/\b(?:mua|lay|dat)\s+(?:[a-z]{1,4}\d{2,5}\s+)?(\d{1,4})\b/)||
          s.match(/\b(?:mua|lay|dat)\s+(\d{1,4})\s+[a-z]{1,4}\d{2,5}\b/);
  let intent='UNKNOWN';
  if(/^\s*(xin chao|chao|hi|hello)\b/.test(s))intent='GREETING';
  else if(/^\s*(huy|dung lai|thoi)\s*$/.test(s))intent='CANCEL';
  else if(/gap nhan vien|gap nguoi|khieu nai/.test(s))intent='HUMAN';
  else if(/\b(?:mua|lay|dat)\b/.test(s))intent='ORDER_PREVIEW';
  else if(sku!=='UNKNOWN')intent='PRODUCT_QUERY';
  return {intent,sku,quantity:m?Number(m[1]):null};
 }});
}
function createQaMemoryReceipts({clock=()=>Date.now(),ttlMs=1800000,maxEntries=2000}={}){
 const data=new Map();
 return Object.freeze({mode:'SINGLE_PROCESS_TEST_ONLY',async claim({scopeKey,receiptHash}){
  if(typeof scopeKey!=='string'||typeof receiptHash!=='string'||!/^([a-f0-9]{64})$/.test(receiptHash))
   fail('RECEIPT_INPUT_INVALID');
  const now=clock();
  for(const [k,expires] of data)if(expires<=now)data.delete(k);
  const key=scopeKey+':'+receiptHash;
  if(data.has(key))return false;
  if(data.size>=maxEntries)fail('RECEIPT_MEMORY_FULL');
  data.set(key,now+ttlMs);return true;
 }});
}
function createQaRateLimiter({clock=()=>Date.now(),max=5,windowMs=60000}={}){
 const states=new Map();
 return Object.freeze({mode:'SINGLE_PROCESS_TEST_ONLY',async allow({scopeKey,actorHash}){
  if(typeof scopeKey!=='string'||!/^[a-f0-9]{64}$/.test(actorHash||''))fail('LIMITER_INPUT_INVALID');
  const now=clock(),key=scopeKey+':'+actorHash;
  const old=states.get(key);
  const next=!old||old.until<=now?{count:0,until:now+windowMs}:old;
  if(next.count>=max)return false;
  next.count++;states.set(key,next);return true;
 }});
}
function createQaMemoryCatalog(rows){
 if(!Array.isArray(rows))fail('CATALOG_FIXTURE_INVALID');
 return Object.freeze({mode:'READ_ONLY_SYNTHETIC',async readProduct({tenantId,storeId,sku}){
  const found=rows.filter(x=>x.tenantId===tenantId&&x.storeId===storeId&&x.sku===sku);
  if(found.length!==1)return null;
  return {...found[0]};
 }});
}
module.exports={createDisabledChannelAdapter,createBlockedPaidModelPort,
 createFixtureIntentClassifier,createQaMemoryReceipts,createQaRateLimiter,createQaMemoryCatalog};
