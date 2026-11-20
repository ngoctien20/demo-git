/**
 * TIEN404 V18.7.6C-M3-H6, isolated and synthetic contract regression.
 * No live Meta credentials, network, storage, data writes, or provider sends.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {createHmac} from "node:crypto";
import {createReceiptHandler} from "../src/receipt-worker.mjs";

const APP_SECRET="SYNTHETIC_H6_APP_SECRET_NEVER_PUBLISH_QA_12345";
const VERIFY_TOKEN="SYNTHETIC_VERIFY_TOKEN_NON_REAL_123456789";
const ENDPOINT="https://h6-offline.invalid/meta-qa/webhook";
const baseEnv=()=>({
 INSPECTOR_ENABLED:"true",
 INSPECTOR_MODE:"ISOLATED_QA_ONLY",
 META_APP_SECRET:APP_SECRET,
 META_VERIFY_TOKEN:VERIFY_TOKEN,
 REDACTED_RECEIPTS_ENABLED:"true",
 REDACTED_RECEIPTS_EXPIRES_AT_MS:String(Date.now()+30*60000)
});
const sentinel={
 psid:"H6_PRIVATE_USER_ID_NEVER_LOG",
 page:"H6_PRIVATE_PAGE_ID_NEVER_LOG",
 mid:"H6_PRIVATE_MESSAGE_ID_NEVER_LOG",
 text:"H6_PRIVATE_CONTENT_NEVER_LOG",
 referral:"H6_PRIVATE_REFERRAL_NEVER_LOG"
};
const events={
 message_reads:{read:{watermark:123456789}},
 message_deliveries:{delivery:{mids:[sentinel.mid],watermark:123456790,seq:2}},
 message_echoes:{message:{is_echo:true,mid:sentinel.mid,text:sentinel.text}}
};
const messaging=type=>({object:"page",entry:[{id:sentinel.page,
 messaging:[{sender:{id:sentinel.psid},recipient:{id:sentinel.page},timestamp:1234,...events[type]}]}]});
const changes=type=>({object:"page",entry:[{id:sentinel.page,
 changes:[{field:type,value:{sender:{id:sentinel.psid},recipient:{id:sentinel.page},...events[type]}}]}]});
const postback=()=>({object:"page",entry:[{changes:[{field:"messaging_postbacks",value:{sender:{id:sentinel.psid},postback:{payload:"QA_POSTBACK_ONLY"}}}]}]});
async function call(envelope,{env=baseEnv(),validSignature=true}={}){
 const logs=[],handler=createReceiptHandler(undefined,text=>logs.push(text));
 const raw=JSON.stringify(envelope);
 const signature="sha256="+(validSignature?createHmac("sha256",APP_SECRET).update(raw).digest("hex"):"f".repeat(64));
 const response=await handler.fetch(new Request(ENDPOINT,{method:"POST",
 headers:{"content-type":"application/json","x-hub-signature-256":signature},body:raw}),env);
 const responseBody=await response.json();
 const marker="TIEN404_QA_REDACTED_RECEIPT ";
 let receipt=null;
 if(logs.length===1&&logs[0].startsWith(marker))receipt=JSON.parse(logs[0].slice(marker.length));
 return {code:response.status,responseBody,logs,receipt};
}
function safeReceipt(receipt,field,count=1){
 assert.ok(receipt);
 assert.equal(receipt.schema,"tien404.meta.qa.redacted-receipt.v1");
 assert.equal(receipt.verifiedHmac,true);
 assert.equal(receipt.httpStatus,200);
 assert.equal(receipt.eventCount,count);
 assert.equal(receipt.eventTypes[field],count);
 assert.equal(receipt.canSend,false);
 assert.equal(receipt.canWrite,false);
 assert.equal(receipt.storeVerified,false);
 assert.equal(receipt.payloadPersisted,false);
}
const classes=["message_reads","message_deliveries","message_echoes"];
for(const field of classes){
 for(const [form,fixture] of [["messaging[]",messaging],["changes[]",changes]]){
  test("H6 signed "+field+" via "+form+" is redacted and acknowledged",async()=>{
   const r=await call(fixture(field));
   assert.equal(r.code,200);
   assert.equal(r.responseBody.signatureValidForSuppliedBytes,true);
   assert.deepEqual(r.responseBody.eventTypes,{[field]:1});
   assert.equal(r.logs.length,1);
   safeReceipt(r.receipt,field);
   const combined=r.logs.join("");
   for(const privateValue of Object.values(sentinel).concat([APP_SECRET,VERIFY_TOKEN]))
    assert.equal(combined.includes(privateValue),false);
  });
  test("H6 bad HMAC "+field+" via "+form+" returns 401 with no receipts",async()=>{
   const r=await call(fixture(field),{validSignature:false});
   assert.equal(r.code,401);
   assert.equal(r.logs.length,0);
   assert.equal(r.responseBody.canSend,false);
  });
 }
 test("H6 "+field+" is silent when receipt window disabled",async()=>{
  const r=await call(messaging(field),{env:{...baseEnv(),REDACTED_RECEIPTS_ENABLED:"false"}});
  assert.equal(r.code,200);assert.deepEqual(r.logs,[]);
 });
 test("H6 "+field+" is silent once deadline has elapsed",async()=>{
  const r=await call(changes(field),{env:{...baseEnv(),REDACTED_RECEIPTS_EXPIRES_AT_MS:String(Date.now()-1200)}});
  assert.equal(r.code,200);assert.deepEqual(r.logs,[]);
 });
}
test("H6 an echoed message is NEVER passed to an AI or Send API",async()=>{
 const r=await call(messaging("message_echoes"));
 assert.equal(r.code,200);
 assert.deepEqual(r.responseBody.eventTypes,{message_echoes:1});
 assert.equal(r.responseBody.canSend,false);
 assert.equal(r.responseBody.canWrite,false);
 assert.equal(r.receipt?.eventTypes?.messages,undefined);
});
test("H6 a non-echo incoming message is not mislabeled as an echo",async()=>{
 const raw={object:"page",entry:[{messaging:[{sender:{id:sentinel.psid},message:{is_echo:false,text:"SYNTHETIC_TEXT"}}]}]};
 const r=await call(raw);
 assert.equal(r.code,200);
 assert.deepEqual(r.responseBody.eventTypes,{messages:1});
 assert.equal(r.receipt.eventTypes.message_echoes,undefined);
 assert.equal(r.responseBody.canSend,false);
});
test("H6 mixed read, delivery and echo remains three NO-SEND receipt classes",async()=>{
 const root={object:"page",entry:[{messaging:Object.values(events).map(ev=>({sender:{id:sentinel.psid},recipient:{id:sentinel.page},...ev}))}]};
 const r=await call(root);
 assert.equal(r.code,200);
 assert.deepEqual(r.receipt.eventTypes,{message_deliveries:1,message_echoes:1,message_reads:1});
 assert.equal(r.receipt.eventCount,3);
 assert.equal(r.receipt.canSend,false);
 assert.equal(r.receipt.canWrite,false);
});
test("H6 postback classification from M5 is retained",async()=>{
 const r=await call(postback());
 assert.equal(r.code,200);safeReceipt(r.receipt,"messaging_postbacks");
});
test("H6 unsupported Page field never leaks injected name",async()=>{
 const root={object:"page",entry:[{changes:[{field:"H6_INJECTED_PRIVATE_VALUE",value:{message:"H6_PRIVATE_PAYLOAD"}}]}]};
 const r=await call(root);
 assert.equal(r.code,200);
 assert.equal(r.receipt.eventTypes.unknown_page_change,1);
 assert.equal(r.logs[0].includes("H6_INJECTED_PRIVATE_VALUE"),false);
});
test("H6 malformed Page envelope denies signed event and emits no receipt",async()=>{
 const r=await call({object:"page",entry:[{message:{text:"SYNTHETIC_UNTYPED"}}]});
 assert.equal(r.code,422);assert.equal(r.logs.length,0);
});
test("H6 missing QA App Secret cannot authenticate a POST",async()=>{
 const {META_APP_SECRET,...env}=baseEnv();
 const r=await call(messaging("message_reads"),{env});
 assert.equal(r.code,401);assert.equal(r.logs.length,0);
});
test("H6 wrong tenant/store claims in payload cannot grant Store access",async()=>{
 const root={object:"page",entry:[{id:sentinel.page,
  messaging:[{sender:{id:sentinel.psid,store_id:"SHOP_A"},read:{watermark:999,owner_role:"admin"}}]}]};
 const r=await call(root);
 assert.equal(r.code,200);
 assert.equal(r.receipt.storeVerified,false);
 assert.equal(r.responseBody.canReadPrivateOrders,false);
});
test("H6 no receipt after far-future deadline exceeding policy",async()=>{
 const r=await call(messaging("message_echoes"),{env:{...baseEnv(),REDACTED_RECEIPTS_EXPIRES_AT_MS:String(Date.now()+120*60000)}});
 assert.equal(r.code,200);assert.equal(r.logs.length,0);
});
