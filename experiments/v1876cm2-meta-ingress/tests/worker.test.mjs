import test from "node:test";
import assert from "node:assert/strict";
import {createHmac} from "node:crypto";
import worker,{WEBHOOK_PATH,MAX_BYTES,eventType,summarizePagePayload} from "../src/worker.mjs";
import {displaySampleToSyntheticFixture} from "../src/dashboard-sample.mjs";
const URL="https://offline-qa.invalid"+WEBHOOK_PATH;
const SECRET="NOT_REAL_META_SECRET_QA_0123456789_ABCDEF";
const TOKEN="NOT_REAL_VERIFY_TOKEN_QA_01234567890123";
const ENV={INSPECTOR_MODE:"ISOLATED_QA_ONLY",INSPECTOR_ENABLED:"true",META_APP_SECRET:SECRET,META_VERIFY_TOKEN:TOKEN};
const msg=e=>({sender:{id:"PRIVATE_PSID_DONT_PRINT"},recipient:{id:"PRIVATE_PAGE_DONT_PRINT"},...e});
const body=e=>({object:"page",entry:[{id:"PRIVATE_PAGE_DONT_PRINT",messaging:[msg(e)]}]});
async function call({object=body({message:{text:"CUSTOMER_PRIVATE_DONT_PRINT"}}),env=ENV,raw,signature,headers={}}={}){
 const bytes=raw??Buffer.from(JSON.stringify(object));
 const sig=signature??("sha256="+createHmac("sha256",SECRET).update(bytes).digest("hex"));
 const req=new Request(URL,{method:"POST",headers:{"content-type":"application/json","x-hub-signature-256":sig,...headers},body:bytes});
 const res=await worker.fetch(req,env);return {response:res,body:await res.json()};
}
const get=(path,env=ENV)=>worker.fetch(new Request("https://offline-qa.invalid"+path),env);
test("disabled by default even with valid HMAC",async()=>assert.equal((await call({env:{}})).response.status,503));
test("wrong mode denies",async()=>assert.equal((await call({env:{...ENV,INSPECTOR_MODE:"LIVE"}})).response.status,503));
test("disabled switch denies",async()=>assert.equal((await call({env:{...ENV,INSPECTOR_ENABLED:"false"}})).response.status,503));
test("wrong path denies",async()=>assert.equal((await get("/unrelated")).status,404));
test("GET verifies challenge only with secret",async()=>{
 const q=new URLSearchParams({"hub.mode":"subscribe","hub.verify_token":TOKEN,"hub.challenge":"qa_challenge_123"});
 const r=await get(WEBHOOK_PATH+"?"+q);assert.equal(r.status,200);assert.equal(await r.text(),"qa_challenge_123");
});
test("wrong GET Verify Token denies",async()=>assert.equal((await get(WEBHOOK_PATH+"?hub.mode=subscribe&hub.verify_token=forged&hub.challenge=123")).status,403));
test("no GET Verify Token denies",async()=>assert.equal((await get(WEBHOOK_PATH+"?hub.mode=subscribe&hub.challenge=123")).status,403));
test("invalid GET challenge denies",async()=>{
 const q=new URLSearchParams({"hub.mode":"subscribe","hub.verify_token":TOKEN,"hub.challenge":"<script>"});
 assert.equal((await get(WEBHOOK_PATH+"?"+q)).status,400);
});
test("invalid hub.mode denies",async()=>{
 const q=new URLSearchParams({"hub.mode":"wrong","hub.verify_token":TOKEN,"hub.challenge":"123"});
 assert.equal((await get(WEBHOOK_PATH+"?"+q)).status,403);
});
test("empty configured verify token denies",async()=>assert.equal((await get(WEBHOOK_PATH+"?hub.mode=subscribe&hub.challenge=123",{...ENV,META_VERIFY_TOKEN:""})).status,403));
test("unsupported HTTP method denies",async()=>assert.equal((await worker.fetch(new Request(URL,{method:"PUT"}),ENV)).status,405));
test("non-JSON content type denies",async()=>assert.equal((await call({headers:{"content-type":"text/plain"}})).response.status,415));
test("bad signature denies",async()=>assert.equal((await call({signature:"sha256="+"0".repeat(64)})).response.status,401));
test("SHA1 signature rejected",async()=>assert.equal((await call({signature:"sha1="+"0".repeat(40)})).response.status,401));
test("missing app secret denies",async()=>assert.equal((await call({env:{...ENV,META_APP_SECRET:""}})).response.status,401));
test("uppercase hex HMAC accepted",async()=>{
 const raw=Buffer.from(JSON.stringify(body({message:{text:"hi"}})));
 const sig="sha256="+createHmac("sha256",SECRET).update(raw).digest("hex").toUpperCase();
 assert.equal((await call({raw,signature:sig})).response.status,200);
});
test("HMAC over exact raw bytes rejects post-signing mutation",async()=>{
 const original=Buffer.from(JSON.stringify(body({message:{text:"original"}})));
 const sig="sha256="+createHmac("sha256",SECRET).update(original).digest("hex");
 const changed=Buffer.from(JSON.stringify(body({message:{text:"modified"}})));
 assert.equal((await call({raw:changed,signature:sig})).response.status,401);
});
test("valid Page message acknowledged with NO-SEND flags",async()=>{
 const r=await call();assert.equal(r.response.status,200);assert.equal(r.body.status,"ACK_ONLY_NO_SEND");
 assert.deepEqual(r.body.eventTypes,{messages:1});assert.equal(r.body.canSend,false);
 assert.equal(r.body.canWrite,false);assert.equal(r.body.storeVerified,false);
 assert.equal(r.body.actualMetaDeliveryVerified,false);assert.equal(r.response.headers.get("cache-control"),"no-store");
});
test("no PSID, Page ID, body, signing secret or token leaked",async()=>{
 const out=JSON.stringify((await call()).body);
 for(const key of ["CUSTOMER_PRIVATE_DONT_PRINT","PRIVATE_PSID_DONT_PRINT","PRIVATE_PAGE_DONT_PRINT",SECRET,TOKEN])assert.equal(out.includes(key),false);
});
for(const [type,field] of [
 ["messaging_postbacks",{postback:{payload:"CREATE_ORDER_NOW"}}],
 ["message_echoes",{message:{is_echo:true,text:"STAFF MESSAGE"}}],
 ["message_deliveries",{delivery:{watermark:1}}],
 ["message_reads",{read:{watermark:2}}],
 ["messaging_handovers",{pass_thread_control:{}}],
 ["messaging_optins",{optin:{}}],
 ["messaging_policy_enforcement",{policy_enforcement:{}}],
 ["messaging_referrals",{referral:{}}],
 ["message_reactions",{reaction:{}}],
 ["message_edits",{message:{is_edit:true}}]
])test(type+" classified and quarantined",async()=>{
 const r=await call({object:body(field)});
 assert.equal(r.response.status,200);assert.equal(r.body.eventTypes[type],1);
 assert.equal(r.body.canSend,false);assert.equal(r.body.canReadPrivateOrders,false);
});
test("standby is not a normal inbound message",async()=>{
 const r=await call({object:{object:"page",entry:[{standby:[msg({message:{text:"never reply"}})]}]}});
 assert.equal(r.body.eventTypes.standby,1);assert.equal(r.body.canSend,false);
});
test("unknown signed event quarantined",async()=>{
 const r=await call({object:body({unknown_event:{action:"danger"}})});
 assert.deepEqual(r.body.eventTypes,{unknown:1});assert.equal(r.body.canSend,false);
});
test("non-page object denied",async()=>assert.equal((await call({object:{object:"user",entry:[{messaging:[{}]}]}})).response.status,422));
test("Dashboard modal sample wrapper is not accepted as live webhook",async()=>{
 const r=await call({object:{sample:{field:"messaging_postbacks",value:{postback:{payload:"UNSAFE"}}}}});
 assert.equal(r.response.status,422);
});
test("signed malformed JSON denied",async()=>assert.equal((await call({raw:Buffer.from("{bad json")})).response.status,400));
test("payload larger than 64 KiB denied",async()=>{
 const r=await call({object:body({message:{text:"X".repeat(MAX_BYTES)}})});
 assert.equal(r.response.status,413);
});
test("more than 10 Page entries denied",async()=>{
 const r=await call({object:{object:"page",entry:Array.from({length:11},()=>({messaging:[{message:{}}]}))}});
 assert.equal(r.response.status,422);
});
test("over 60 event batch denied",async()=>{
 const r=await call({object:{object:"page",entry:[{messaging:Array.from({length:61},()=>({message:{}}))}]}});
 assert.equal(r.response.status,422);
});
test("empty message container denied",async()=>assert.equal((await call({object:{object:"page",entry:[{}]}})).response.status,422));
test("invalid container type denied",async()=>assert.equal((await call({object:{object:"page",entry:[{messaging:{}}]}})).response.status,422));
test("multi-Page input only produces aggregate counts",async()=>{
 const r=await call({object:{object:"page",entry:[{id:"SECRET_PAGE_A",messaging:[{read:{}}]},{id:"SECRET_PAGE_C",messaging:[{delivery:{}}]}]}});
 assert.deepEqual(r.body.eventTypes,{message_deliveries:1,message_reads:1});
 assert.equal(JSON.stringify(r.body).includes("SECRET_PAGE_A"),false);
});
test("Meta v27 dashboard postback modal fixture is sanitized offline",()=>{
 const src={sample:{field:"messaging_postbacks",value:{sender:{id:"12334"},recipient:{id:"23245"},postback:{mid:"m_private",title:"TITLE",payload:"USER-DEFINED-PAYLOAD",referral:{ref:"X"}}}}};
 const fixture=displaySampleToSyntheticFixture(src);
 assert.equal(fixture?.object,"page");assert.equal(eventType(fixture.entry[0].messaging[0]),"messaging_postbacks");
 assert.equal(JSON.stringify(fixture).includes("12334"),false);
 assert.equal(JSON.stringify(fixture).includes("USER-DEFINED-PAYLOAD"),false);
});
test("unknown sample field cannot become trusted fixture",()=>assert.equal(displaySampleToSyntheticFixture({sample:{field:"payments",value:{payment:{}}}}),null));
test("converted sample is synthetic structure only",()=>{
 const x=displaySampleToSyntheticFixture({sample:{field:"messages",value:{message:{text:"hello"}}}});
 assert.deepEqual(summarizePagePayload(x),{count:1,types:{messages:1}});
});
test("no AI tools, order writer or forwarding callable",async()=>{
 const out=(await call()).body;
 assert.equal(typeof out.send,"undefined");assert.equal(typeof out.createOrder,"undefined");
 assert.equal(typeof out.queryStore,"undefined");
});
