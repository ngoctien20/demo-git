import test from "node:test";
import assert from "node:assert/strict";
import {createHmac} from "node:crypto";
import {createReceiptHandler,redactReceipt} from "../src/receipt-worker.mjs";
const SECRET="SYNTHETIC_META_APP_SECRET_LONG_ENOUGH_123456";
const ENV=Object.freeze({INSPECTOR_MODE:"ISOLATED_QA_ONLY",INSPECTOR_ENABLED:"true",META_APP_SECRET:SECRET,META_VERIFY_TOKEN:"TEST_VERIFY_TOKEN_QA_1234567890",REDACTED_RECEIPTS_ENABLED:"true"});
const URL="https://offline-qa.invalid/meta-qa/webhook";
const sample=(payload,via="messaging")=>({object:"page",entry:[{id:"PRIVATE_QA_PAGE_ID",[via]:[{sender:{id:"PRIVATE_QA_PSID"},recipient:{id:"PRIVATE_QA_PAGE_ID"},...payload}]}]});
const sampleChange=(field,value)=>({object:"page",entry:[{id:"PRIVATE_QA_PAGE_ID",changes:[{field,value}]}]});
function request(payload,signatureOverride){
 const body=JSON.stringify(payload);
 const signature="sha256="+createHmac("sha256",SECRET).update(body).digest("hex");
 return new Request(URL,{method:"POST",headers:{"content-type":"application/json","x-hub-signature-256":signatureOverride||signature},body});
}
async function run(payload,env=ENV,signatureOverride){
 const logs=[];
 const handler=createReceiptHandler(undefined,line=>logs.push(line));
 const response=await handler.fetch(request(payload,signatureOverride),env);
 return {response,body:await response.json(),logs};
}
test("M4 opt-out by default produces no receipt",async()=>{
 const {response,logs}=await run(sample({message:{text:"PRIVATE_MESSAGE"}}),{...ENV,REDACTED_RECEIPTS_ENABLED:"false"});
 assert.equal(response.status,200);assert.equal(logs.length,0);
});
test("M4 unset telemetry flag does not log",async()=>{
 const {REDACTED_RECEIPTS_ENABLED,...env}=ENV;
 const r=await run(sample({message:{text:"PRIVATE_MESSAGE"}}),env);
 assert.equal(r.response.status,200);assert.equal(r.logs.length,0);
});
for(const [kind,event] of [
 ["messages",{message:{text:"PRIVATE_MESSAGE"}}],
 ["messaging_postbacks",{postback:{payload:"PRIVATE_BUTTON"}}],
 ["message_reads",{read:{watermark:12345}}],
 ["message_deliveries",{delivery:{watermark:12345}}],
 ["message_echoes",{message:{is_echo:true,text:"PRIVATE_ECHO"}}],
 ["messaging_handovers",{pass_thread_control:{metadata:"PRIVATE_HANDOVER"}}],
 ["message_edits",{message:{is_edit:true,text:"PRIVATE_EDIT"}}],
 ["message_reactions",{reaction:{reaction:"like"}}]
]){
 test("M4 signed "+kind+" logs only redacted class and counts",async()=>{
  const r=await run(sample(event));
  assert.equal(r.response.status,200);assert.equal(r.logs.length,1);
  const prefix="TIEN404_QA_REDACTED_RECEIPT ";
  assert.ok(r.logs[0].startsWith(prefix));
  const item=JSON.parse(r.logs[0].slice(prefix.length));
  assert.equal(item.verifiedHmac,true);
  assert.equal(item.httpStatus,200);assert.equal(item.eventTypes[kind],1);
  assert.equal(item.canSend,false);assert.equal(item.canWrite,false);
  assert.equal(item.payloadPersisted,false);
  assert.match(item.receiptId,/^[a-f0-9-]{36}$/);
  for(const value of ["PRIVATE_MESSAGE","PRIVATE_ECHO","PRIVATE_BUTTON","PRIVATE_QA_PAGE_ID","PRIVATE_QA_PSID","PRIVATE_HANDOVER","PRIVATE_EDIT",SECRET])
   assert.equal(r.logs[0].includes(value),false,"sensitive content "+value);
 });
}
for(const field of ["messaging_postbacks","message_reads","message_deliveries","message_echoes"]){
 test("M4 Meta changes[] "+field+" is accepted only with valid HMAC",async()=>{
  const value=field==="messaging_postbacks"?{postback:{payload:"SECRET_PAYLOAD"}}:{message:{text:"PRIVATE"}};
  const r=await run(sampleChange(field,value));
  assert.equal(r.response.status,200);assert.equal(r.logs.length,1);
  const receipt=JSON.parse(r.logs[0].split("TIEN404_QA_REDACTED_RECEIPT ")[1]);
  assert.equal(receipt.eventTypes[field],1);
  assert.equal(receipt.eventCount,1);
  assert.equal(r.logs[0].includes("SECRET_PAYLOAD"),false);
 });
}
test("M4 invalid HMAC produces no receipt",async()=>{
 const r=await run(sample({message:{text:"PRIVATE"}}),ENV,"sha256="+"0".repeat(64));
 assert.equal(r.response.status,401);assert.deepEqual(r.logs,[]);
});
test("M4 bad Page event produces no receipt",async()=>{
 const r=await run({object:"page",entry:[{unknown:true}]});
 assert.equal(r.response.status,422);assert.deepEqual(r.logs,[]);
});
test("M4 disabled worker never logs",async()=>{
 const r=await run(sample({read:{watermark:1}}),{...ENV,INSPECTOR_ENABLED:"false"});
 assert.equal(r.response.status,503);assert.deepEqual(r.logs,[]);
});
test("M4 unrelated GET challenge never logs",async()=>{
 const logs=[];
 const handler=createReceiptHandler(undefined,s=>logs.push(s));
 const query=new URLSearchParams({"hub.mode":"subscribe","hub.verify_token":ENV.META_VERIFY_TOKEN,"hub.challenge":"1234"});
 const res=await handler.fetch(new Request(URL+"?"+query),ENV);
 assert.equal(res.status,200);assert.deepEqual(logs,[]);
});
test("M4 output is bytewise equivalent to original accepted response",async()=>{
 const a=await run(sample({read:{watermark:1}}),{...ENV,REDACTED_RECEIPTS_ENABLED:"false"});
 const b=await run(sample({read:{watermark:1}}));
 assert.equal(JSON.stringify(a.body),JSON.stringify(b.body));
});
test("M4 unknown change fields are anonymized",async()=>{
 const r=await run(sampleChange("INJECT_PRIVATE_FIELD",{message:"SECRET"}));
 assert.equal(r.response.status,200);assert.equal(r.logs.length,1);
 assert.ok(r.logs[0].includes("unknown_page_change"));
 assert.equal(r.logs[0].includes("INJECT_PRIVATE_FIELD"),false);
});
test("M4 malicious eventTypes property is rejected from receipt",()=>{
 const fake={status:"ACK_ONLY_NO_SEND",signatureValidForSuppliedBytes:true,
  canSend:false,canWrite:false,storeVerified:false,eventCount:1,
  eventTypes:{"PRIVATE_PSID_DO_NOT_LOG":1}};
 assert.equal(redactReceipt(fake,"a".repeat(36)),null);
});
test("M4 invalid counts cannot be logged",()=>{
 const base={status:"ACK_ONLY_NO_SEND",signatureValidForSuppliedBytes:true,
 canSend:false,canWrite:false,storeVerified:false,eventCount:1};
 assert.equal(redactReceipt({...base,eventTypes:{"message_reads":2}},"a".repeat(36)),null);
 assert.equal(redactReceipt({...base,eventTypes:{"message_reads":-1}},"a".repeat(36)),null);
 assert.equal(redactReceipt({...base,eventTypes:{"message_reads":1},"eventCount":1000},"a".repeat(36)),null);
});
test("M4 false HMAC flag cannot log",()=>{
 const fake={status:"ACK_ONLY_NO_SEND",signatureValidForSuppliedBytes:false,canSend:false,canWrite:false,storeVerified:false,eventCount:1,eventTypes:{"messages":1}};
 assert.equal(redactReceipt(fake,"a".repeat(36)),null);
});
test("M4 no provider/Commerce actions are exposed by wrapper",()=>{
 const h=createReceiptHandler();
 assert.equal(typeof h.sendMessage,"undefined");
 assert.equal(typeof h.createOrder,"undefined");
 assert.equal(typeof h.readStore,"undefined");
});
test("M4 without explicit store authentication remains storeVerified false",async()=>{
 const r=await run(sample({postback:{payload:"CLAIM_STORE_A"}}));
 assert.equal(r.body.storeVerified,false);
 assert.equal(JSON.parse(r.logs[0].split("TIEN404_QA_REDACTED_RECEIPT ")[1]).storeVerified,false);
});
test("M4 no log for wrong method",async()=>{
 const logs=[], h=createReceiptHandler(undefined,s=>logs.push(s));
 const r=await h.fetch(new Request(URL,{method:"PUT"}),ENV);
 assert.equal(r.status,405);assert.deepEqual(logs,[]);
});
test("M4 failed logger cannot break signed POST acceptance",async()=>{
 const h=createReceiptHandler(undefined,()=>{throw Error("TEST_LOGGING_UNAVAILABLE");});
 const res=await h.fetch(request(sample({read:{watermark:1}})),ENV);
 assert.equal(res.status,200);
});
