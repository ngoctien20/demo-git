import test from "node:test";
import assert from "node:assert/strict";
import {createHmac} from "node:crypto";
import worker from "../src/worker.mjs";
import {makeRedactedReceipt,recordQaPostReceipt} from "../src/redacted-receipts.mjs";

const URL="https://offline-qa.invalid/meta-qa/webhook";
const SECRET="SYNTHETIC_QA_H4_SECRET_FOR_UNIT_TEST_ONLY_ABCD";
const TOKEN="SYNTHETIC_QA_H4_VERIFY_TOKEN_FOR_UNIT_TESTS";
const QA={INSPECTOR_MODE:"ISOLATED_QA_ONLY",INSPECTOR_ENABLED:"true",
 META_APP_SECRET:SECRET,META_VERIFY_TOKEN:TOKEN};
const LOGGED={...QA,QA_TELEMETRY_ENABLED:"true",QA_TELEMETRY_CONSENT:"APPROVED"};
const msg=e=>({sender:{id:"SENSITIVE_TEST_PSID"},recipient:{id:"SENSITIVE_TEST_PAGE"},...e});
const event=field=>({object:"page",entry:[{id:"SENSITIVE_TEST_PAGE",changes:[{field,
 value:{sender:{id:"SENSITIVE_TEST_PSID"},recipient:{id:"SENSITIVE_TEST_PAGE"},
  postback:{payload:"SENSITIVE_TEST_PAYLOAD"},message:{text:"SENSITIVE_TEST_MESSAGE"},read:{watermark:123}}
}]}]});
const pageMsg=()=>({object:"page",entry:[{messaging:[msg({message:{text:"SENSITIVE_TEST_MESSAGE"}})]}]});
function signed(payload){
 const raw=JSON.stringify(payload);
 return {body:raw,headers:{"content-type":"application/json","x-hub-signature-256":"sha256="+createHmac("sha256",SECRET).update(raw).digest("hex")}};
}
async function captureRequest(env,request){
 const logs=[],prev=console.info;
 console.info=(entry)=>logs.push(String(entry));
 try{
  const response=await worker.fetch(request,env);
  return {response,logs,receipts:logs.map(x=>JSON.parse(x))};
 }finally{console.info=prev;}
}
const POST=(payload=event("messaging_postbacks"))=>new Request(URL,{method:"POST",...signed(payload)});
const GET=()=>new Request(URL+"?hub.mode=subscribe&hub.verify_token="+TOKEN+"&hub.challenge=TEST_CHALLENGE");

test("default flag absent never emits receipts even for signed 200",async()=>{
 const r=await captureRequest(QA,POST());
 assert.equal(r.response.status,200);assert.equal(r.logs.length,0);
});
test("first flag alone does not enable telemetry",async()=>{
 const r=await captureRequest({...QA,QA_TELEMETRY_ENABLED:"true"},POST());
 assert.equal(r.response.status,200);assert.equal(r.logs.length,0);
});
test("consent alone does not enable telemetry",async()=>{
 const r=await captureRequest({...QA,QA_TELEMETRY_CONSENT:"APPROVED"},POST());
 assert.equal(r.response.status,200);assert.equal(r.logs.length,0);
});
test("wrong consent does not enable telemetry",async()=>{
 const r=await captureRequest({...LOGGED,QA_TELEMETRY_CONSENT:"public"},POST());
 assert.equal(r.response.status,200);assert.equal(r.logs.length,0);
});
test("GET Verify Token success never goes into custom receipt logs",async()=>{
 const r=await captureRequest(LOGGED,GET());
 assert.equal(r.response.status,200);assert.equal(r.logs.length,0);
 assert.equal(await r.response.text(),"TEST_CHALLENGE");
});
test("GET Verify Token rejected never emits custom telemetry",async()=>{
 const r=await captureRequest(LOGGED,new Request(URL+"?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=123"));
 assert.equal(r.response.status,403);assert.equal(r.logs.length,0);
});
test("signed Postback yields one minimal immutable 200 receipt",async()=>{
 const r=await captureRequest(LOGGED,POST());
 assert.equal(r.response.status,200);assert.equal(r.receipts.length,1);
 const x=r.receipts[0];
 assert.equal(x.schema,"tien404.meta.qa.receipt.v1");
 assert.equal(x.httpStatus,200);assert.equal(x.decision,"ACCEPTED");
 assert.equal(x.hmacVerified,true);assert.equal(x.requestMethod,"POST");
 assert.deepEqual(x.eventTypes,{messaging_postbacks:1});
 assert.equal(x.canSend,false);assert.equal(x.canWrite,false);
 assert.equal(x.metaDeliveryVerified,false);assert.equal(x.pageSubscriptionVerified,false);
 assert.match(x.receiptId,/^[0-9a-f-]{36}$/);assert.match(x.occurredAt,/^\d{4}-\d\d-\d\dT/);
});
test("known Page changes[] read sample safely classified",async()=>{
 const r=await captureRequest(LOGGED,POST(event("message_reads")));
 assert.equal(r.response.status,200);
 assert.deepEqual(r.receipts[0].eventTypes,{message_reads:1});
});
test("known Page changes[] delivery sample safely classified",async()=>{
 const r=await captureRequest(LOGGED,POST(event("message_deliveries")));
 assert.equal(r.response.status,200);
 assert.deepEqual(r.receipts[0].eventTypes,{message_deliveries:1});
});
test("known Page changes[] echo sample safely classified",async()=>{
 const r=await captureRequest(LOGGED,POST(event("message_echoes")));
 assert.equal(r.response.status,200);
 assert.deepEqual(r.receipts[0].eventTypes,{message_echoes:1});
});
test("messaging[] Page message also safely classified",async()=>{
 const r=await captureRequest(LOGGED,POST(pageMsg()));
 assert.equal(r.response.status,200);
 assert.deepEqual(r.receipts[0].eventTypes,{messages:1});
});
test("Page changes[] handover remains no-send",async()=>{
 const r=await captureRequest(LOGGED,POST(event("messaging_handovers")));
 assert.equal(r.response.status,200);assert.equal(r.receipts[0].canSend,false);
});
test("unknown signed change field is normalized",async()=>{
 const r=await captureRequest(LOGGED,POST(event("USER_SECRET_FIELD")));
 assert.equal(r.response.status,200);
 assert.deepEqual(r.receipts[0].eventTypes,{unknown_page_change:1});
});
test("signed POST with bad HMAC creates only a 401 negative receipt",async()=>{
 const s=signed(event("messaging_postbacks"));
 s.headers["x-hub-signature-256"]="sha256="+"f".repeat(64);
 const r=await captureRequest(LOGGED,new Request(URL,{method:"POST",...s}));
 assert.equal(r.response.status,401);assert.equal(r.receipts.length,1);
 assert.equal(r.receipts[0].decision,"META_SIGNATURE_INVALID");
 assert.equal(r.receipts[0].hmacVerified,false);
 assert.deepEqual(r.receipts[0].eventTypes,{});
});
test("unsigned POST creates minimal 401 negative receipt",async()=>{
 const r=await captureRequest(LOGGED,new Request(URL,{method:"POST",body:"{}",headers:{"content-type":"application/json"}}));
 assert.equal(r.response.status,401);assert.equal(r.receipts[0].hmacVerified,false);
});
test("wrong Content-Type denied and not marked HMAC verified",async()=>{
 const r=await captureRequest(LOGGED,new Request(URL,{method:"POST",headers:{"content-type":"text/plain"},body:"SECRET_TEXT"}));
 assert.equal(r.response.status,415);assert.equal(r.receipts[0].decision,"CONTENT_TYPE_DENIED");
 assert.equal(r.receipts[0].hmacVerified,false);
});
test("malformed but signed JSON marks only signature verified, not accepted",async()=>{
 const raw="{bad json";
 const signature="sha256="+createHmac("sha256",SECRET).update(raw).digest("hex");
 const r=await captureRequest(LOGGED,new Request(URL,{method:"POST",body:raw,headers:{"content-type":"application/json","x-hub-signature-256":signature}}));
 assert.equal(r.response.status,400);assert.equal(r.receipts[0].decision,"INVALID_JSON");
 assert.equal(r.receipts[0].hmacVerified,true);assert.deepEqual(r.receipts[0].eventTypes,{});
});
test("signed non-Page envelope produces 422 with HMAC-valid boolean",async()=>{
 const r=await captureRequest(LOGGED,POST({object:"user",entry:[{}]}));
 assert.equal(r.response.status,422);assert.equal(r.receipts[0].decision,"PAGE_EVENT_INVALID");
 assert.equal(r.receipts[0].hmacVerified,true);
});
test("disabled Worker does not log unless double telemetry gate",async()=>{
 const r=await captureRequest(QA,new Request(URL,{method:"POST",...signed(event("messaging_postbacks"))}));
 assert.equal(r.receipts.length,0);
});
test("unexpected path POST logs only allowed decision",async()=>{
 const r=await captureRequest(LOGGED,new Request("https://offline-qa.invalid/private?key=SECRET_QUERY",{method:"POST",...signed(event("messaging_postbacks"))}));
 assert.equal(r.response.status,404);assert.equal(r.receipts[0].decision,"UNKNOWN_PATH");
 assert.equal(JSON.stringify(r.receipts).includes("SECRET_QUERY"),false);
});
test("receipt logs exclude tokens, signatures, PSID, Page ID and contents",async()=>{
 const r=await captureRequest(LOGGED,POST());
 const result=JSON.stringify(r.receipts);
 for(const s of [SECRET,TOKEN,"SENSITIVE_TEST_PSID","SENSITIVE_TEST_PAGE","SENSITIVE_TEST_PAYLOAD","SENSITIVE_TEST_MESSAGE","hub.verify_token","X-Hub-Signature-256"]){
  assert.equal(result.includes(s),false,s);
 }
});
test("receipt builder strips attacker-supplied status, decision and keys",()=>{
 const x=makeRedactedReceipt({httpStatus:123,decision:"SECRET_CLASSIFICATION",hmacVerified:"true",
  eventTypes:{messaging_postbacks:2,"SECRET_PSID":23,unknown_page_change:1,message_reads:"2",messages:999}},
  ()=>"2026-11-19T13:32:40.000Z",()=> "STATIC_QA_RECEIPT");
 assert.equal(x.httpStatus,500);assert.equal(x.decision,"UNCLASSIFIED");
 assert.equal(x.hmacVerified,false);
 assert.deepEqual({...x.eventTypes},{messaging_postbacks:2,unknown_page_change:1});
 assert.equal(JSON.stringify(x).includes("SECRET_PSID"),false);
});
test("receipt ID is generated locally, not derived from Page ID",()=>{
 const x=makeRedactedReceipt({httpStatus:200,decision:"ACCEPTED",eventTypes:{}},
  ()=>"2026-11-19T13:32:40Z",()=>"QA_RECEIPT_NON_IDENTIFYING");
 assert.equal(x.receiptId,"QA_RECEIPT_NON_IDENTIFYING");assert.equal(x.environment,"QA_ONLY");
});
test("logs stay disabled if no opt-in even when logger throws",()=>{
 const s=recordQaPostReceipt(QA,{httpStatus:200,decision:"ACCEPTED"},()=>{throw Error("should not run")});
 assert.equal(s,false);
});
test("logging exception cannot impact Messenger webhook request",()=>{
 const previous=console.info;console.info=()=>{throw new Error("logger unavailable");};
 try{
  return worker.fetch(POST(),LOGGED).then(r=>assert.equal(r.status,200));
 }finally{console.info=previous;}
});
test("returned decision object contains only documented allowlist properties",()=>{
 const x=makeRedactedReceipt({httpStatus:200,decision:"ACCEPTED",eventTypes:{messages:1}},
 ()=>"2026-11-19T13:32:40Z",()=>"QA_ID");
 assert.deepEqual(Object.keys(x),[
 "schema","receiptId","occurredAt","environment","requestMethod","httpStatus",
 "decision","hmacVerified","eventTypes","canSend","canWrite","canReadPrivateOrders",
 "storeVerified","metaDeliveryVerified","pageSubscriptionVerified"
 ]);
});
test("summary has no URL/request object and always marks Store unverified",()=>{
 const x=makeRedactedReceipt({httpStatus:200,decision:"ACCEPTED",eventTypes:{messages:1}});
 assert.equal(x.storeVerified,false);assert.equal(x.metaDeliveryVerified,false);
 assert.equal(typeof x.url,"undefined");assert.equal(typeof x.headers,"undefined");
});
