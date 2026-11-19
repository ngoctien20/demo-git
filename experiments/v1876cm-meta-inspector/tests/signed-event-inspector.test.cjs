"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {createHmac}=require("node:crypto");
const {inspectSignedMetaWebhook:inspect,SUPPORTED,MAX_BYTES}=require("../src/signed-event-inspector.cjs");
const SECRET=Buffer.alloc(32,0x34); // synthetic test fixture, not an app secret
const entry=(message,container="messaging")=>({object:"page",entry:[{id:"QA_PRIVATE_PAGE_DO_NOT_OUTPUT",[container]:[message]}]});
const message=(payload={})=>({sender:{id:"QA_CUSTOMER_PSID_DO_NOT_OUTPUT"},recipient:{id:"QA_PRIVATE_PAGE_DO_NOT_OUTPUT"},timestamp:123,...payload});
function seal(body, secret=SECRET){
 const rawBody=Buffer.from(JSON.stringify(body),"utf8");
 return {rawBody,signature256:"sha256="+createHmac("sha256",secret).update(rawBody).digest("hex"),appSecret:secret};
}
const inspectEvent=(payload,container="messaging")=>inspect(seal(entry(message(payload),container)));
const expected=Object.freeze([
 ["messages",{message:{mid:"QA_MID_SECRET",text:"QA MESSAGE TEXT DO NOT ECHO"}}],
 ["messaging_postbacks",{postback:{payload:"QA_POSTBACK_DO_NOT_ACT"}}],
 ["message_echoes",{message:{mid:"QA_MID",is_echo:true,text:"STAFF MESSAGE"}}],
 ["message_deliveries",{delivery:{mids:["QA_MID_SECRET"],watermark:444}}],
 ["message_reads",{read:{watermark:555}}],
 ["messaging_referrals",{referral:{ref:"QA_REF",source:"SHORTLINK"}}],
 ["messaging_handovers",{pass_thread_control:{new_owner_app_id:"QA_APP_ID"}}],
 ["messaging_optins",{optin:{ref:"QA_OPTIN"}}],
 ["messaging_policy_enforcement",{policy_enforcement:{action:"warning"}}],
 ["message_reactions",{reaction:{reaction:"love",mid:"QA_MID"}}],
 ["message_edits",{message:{mid:"QA_MID",is_edit:true,text:"changed"}}]
]);
for(const [type,payload] of expected){
 test(type+" is classified and quarantined",()=>{
  const r=inspectEvent(payload);
  assert.equal(r.ok,true);assert.equal(r.events.length,1);assert.equal(r.events[0].type,type);
  assert.equal(r.events[0].classification,"KNOWN_NO_SEND");
  assert.equal(r.events[0].intendedAction,"QUARANTINE_NO_SEND");
  assert.equal(r.events[0].allowsAgent,false);assert.equal(r.events[0].canSend,false);
  assert.equal(r.events[0].canWrite,false);assert.equal(r.events[0].canReadPrivateOrders,false);
  assert.equal(r.storeVerified,false);assert.equal(r.installationVerified,false);
  assert.equal(r.liveMetaVerified,false);assert.equal(r.pageLevelSubscriptionVerified,false);
 });
}
test("standby event does not become normal message",()=>{
 const r=inspectEvent({message:{text:"do not reply"}}, "standby");
 assert.equal(r.ok,true);assert.equal(r.events[0].type,"standby");
 assert.equal(r.events[0].allowsAgent,false);
});
test("request_thread_control classifies handover",()=>assert.equal(inspectEvent({request_thread_control:{metadata:"QA"}}).events[0].type,"messaging_handovers"));
test("take_thread_control classifies handover",()=>assert.equal(inspectEvent({take_thread_control:{previous_owner_app_id:"QA"}}).events[0].type,"messaging_handovers"));
test("is_echo takes precedence over is_edit",()=>{
 assert.equal(inspectEvent({message:{is_echo:true,is_edit:true}}).events[0].type,"message_echoes");
});
test("unknown message field goes to quarantine",()=>{
 const r=inspectEvent({unknown_event:{danger:"unknown"}});
 assert.equal(r.ok,true);assert.equal(r.events[0].classification,"UNRECOGNIZED_QUARANTINED");
});
test("postback does not invoke cart or order action",()=>{
 const r=inspectEvent({postback:{payload:"CREATE_ORDER_NOW"}});
 assert.equal(r.ok,true);assert.equal(r.events[0].allowsAgent,false);assert.equal(r.canWrite,false);
});
test("signed body does not identify a Store",()=>{
 const body=entry(message({message:{text:"store=Store C"}}));
 body.entry[0].id="QA_CLAIMED_OTHER_PAGE";
 const r=inspect(seal(body));
 assert.equal(r.storeVerified,false);assert.equal(r.events[0].storeScope,"UNRESOLVED");
 assert.equal(r.events[0].pageScope,"UNRESOLVED");
});
test("raw PSID, page id, content, message id never returned",()=>{
 const r=inspectEvent({message:{text:"QA MESSAGE TEXT DO NOT ECHO",mid:"QA_MID_SECRET"}});
 const result=JSON.stringify(r);
 for(const value of ["QA_CUSTOMER_PSID_DO_NOT_OUTPUT","QA_PRIVATE_PAGE_DO_NOT_OUTPUT","QA MESSAGE TEXT DO NOT ECHO","QA_MID_SECRET","STAFF MESSAGE"]){
   assert.equal(result.includes(value),false,value);
 }
});
test("valid HMAC proves only supplied fixture bytes, not live Meta",()=>{
 const r=inspectEvent({message:{text:"hello"}});
 assert.equal(r.signatureValidForSuppliedBytes,true);
 assert.equal(r.liveMetaVerified,false);assert.equal(r.canReadPrivateOrders,false);
});
test("invalid signature fails closed",()=>{
 const valid=seal(entry(message({message:{text:"hello"}})));
 const bad={...valid, signature256:"sha256"+"="+ "f".repeat(64)};
 assert.equal(inspect(bad).reason,"SIGNATURE_INVALID");
});
test("mutating raw body after HMAC rejected",()=>{
 const e=seal(entry(message({message:{text:"hello"}})));
 e.rawBody=Buffer.from(e.rawBody.toString().replace("hello","world"));
 assert.equal(inspect(e).reason,"SIGNATURE_INVALID");
});
test("wrong signing key rejected",()=>{
 const e=seal(entry(message({message:{text:"hello"}})));
 e.appSecret=Buffer.alloc(32,0x35);
 assert.equal(inspect(e).reason,"SIGNATURE_INVALID");
});
test("missing signature rejected",()=>assert.equal(inspect({rawBody:Buffer.from("{}"),appSecret:SECRET}).reason,"SIGNATURE_FORMAT_INVALID"));
test("sha1 signature unsupported",()=>{
 const e=seal(entry(message({read:{watermark:10}})));
 e.signature256="sha1="+"0".repeat(40);
 assert.equal(inspect(e).reason,"SIGNATURE_FORMAT_INVALID");
});
test("tiny app secret denied",()=>{
 const e=seal(entry(message({message:{text:"hello"}})));
 e.appSecret=Buffer.from("too short");
 assert.equal(inspect(e).reason,"APP_SECRET_INVALID");
});
test("untrusted string body denied, not reserialized",()=>{
 const e=seal(entry(message({message:{text:"hello"}})));
 e.rawBody=e.rawBody.toString("utf8");
 assert.equal(inspect(e).reason,"RAW_BODY_INVALID");
});
test("empty raw buffer denied",()=>assert.equal(inspect({rawBody:Buffer.alloc(0),signature256:"sha256="+"0".repeat(64),appSecret:SECRET}).reason,"RAW_BODY_INVALID"));
test("excessive raw bytes denied before HMAC",()=>{
 const e=seal({object:"page",entry:[{messaging:[message({message:{text:"X".repeat(MAX_BYTES)}})]}]});
 assert.equal(inspect(e).reason,"RAW_BODY_INVALID");
});
test("valid signature but bad json rejected",()=>{
 const rawBody=Buffer.from("{not-json");
 const signature256="sha256="+createHmac("sha256",SECRET).update(rawBody).digest("hex");
 assert.equal(inspect({rawBody,signature256,appSecret:SECRET}).reason,"INVALID_JSON");
});
test("non-Page object rejected",()=>assert.equal(inspect(seal({object:"user",entry:[{messaging:[{}]}]})).reason,"PAGE_ENVELOPE_INVALID"));
test("missing entries rejected",()=>assert.equal(inspect(seal({object:"page"})).reason,"PAGE_ENVELOPE_INVALID"));
test("too many Page entries rejected",()=>{
 const arr=Array.from({length:11},()=>({messaging:[{}]}));
 assert.equal(inspect(seal({object:"page",entry:arr})).reason,"PAGE_ENVELOPE_INVALID");
});
test("malformed messaging list rejected",()=>assert.equal(inspect(seal({object:"page",entry:[{messaging:{"0":{}}}]})).reason,"EVENT_BATCH_INVALID"));
test("overlarge batch rejected",()=>{
 const b={object:"page",entry:[{messaging:Array.from({length:61},()=>message({message:{text:"hi"}}))}]};
 assert.equal(inspect(seal(b)).reason,"EVENT_BATCH_INVALID");
});
test("too many combined messaging + standby rejected",()=>{
 const b={object:"page",entry:[{messaging:Array.from({length:35},()=>message({message:{text:"x"}})),standby:Array.from({length:30},()=>message({message:{text:"x"}}))}]};
 assert.equal(inspect(seal(b)).reason,"EVENT_LIMIT_EXCEEDED");
});
test("multiple entries from different pages only give aggregate counts",()=>{
 const b={object:"page",entry:[
   {id:"QA_PRIVATE_PAGE_A",messaging:[message({read:{watermark:1}})]},
   {id:"QA_PRIVATE_PAGE_C",messaging:[message({delivery:{watermark:2}})]}
 ]};
 const r=inspect(seal(b));
 assert.deepEqual(r.counts,{"message_reads":1,"message_deliveries":1});
 assert.equal(JSON.stringify(r).includes("QA_PRIVATE_PAGE_A"),false);
});
test("feed events never impersonate Messenger",()=>assert.equal(inspect(seal({object:"page",entry:[{changes:[{field:"feed",value:{text:"hello"}}]}]})).reason,"NO_RECOGNIZED_MESSAGE_CONTAINER"));
test("malformed Standby list rejected",()=>assert.equal(inspect(seal({object:"page",entry:[{standby:{}}]})).reason,"EVENT_BATCH_INVALID"));
test("unknown input extra store claim rejected",()=>{
 const e=seal(entry(message({message:{text:"hello"}})));
 e.store_id="store_c";
 assert.equal(inspect(e).reason,"INPUT_SHAPE_INVALID");
});
test("unknown input extra role claim rejected",()=>{
 const e=seal(entry(message({message:{text:"hello"}})));
 e.role="admin";
 assert.equal(inspect(e).reason,"INPUT_SHAPE_INVALID");
});
test("known event table includes required priorities",()=>{
 for(const t of ["messages","messaging_postbacks","message_deliveries","message_reads","message_echoes","messaging_handovers","standby"])assert.ok(SUPPORTED.includes(t));
});
test("result objects are immutable",()=>{
 const r=inspectEvent({message:{text:"hey"}});
 assert.equal(Object.isFrozen(r),true);
 assert.equal(Object.isFrozen(r.events),true);
 assert.equal(Object.isFrozen(r.events[0]),true);
 assert.equal(Object.isFrozen(r.counts),true);
});
test("no SQL, HTTP or message tool returned",()=>{
 const r=inspectEvent({message:{text:"hello"}});
 assert.equal(typeof r.send,"undefined");assert.equal(typeof r.createOrder,"undefined");assert.equal(typeof r.queryStore,"undefined");
});
test("wrong signature must not leak payload contents",()=>{
 const e=seal(entry(message({message:{text:"secret"}})));
 e.signature256="sha256="+"f".repeat(64);
 const r=inspect(e);
 assert.equal(JSON.stringify(r).includes("secret"),false);
});
