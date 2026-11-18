// Synthetic/offline only. This validates the independent strict QA candidate,
// NOT any real Zalo delivery, Cloudflare WAF, Store authority or Commerce Core.
import test from "node:test";
import assert from "node:assert/strict";
import { inspectStrictZaloQaEnvelope } from "../strict-zalo-contract-candidate.mjs";

const NOW = 1795000000000;
const CHALLENGE = "TIEN404-QA-" + "x".repeat(32);
const opts = () => ({ nowMs: NOW, expectedChallenge: CHALLENGE });
function canonical() {
  return {
    ok: true,
    result: {
      event_name: "message.text.received",
      message: {
        from: { id: "synthetic_user_a_000001", is_bot: false },
        chat: { id: "synthetic_user_a_000001", chat_type: "PRIVATE" },
        message_id: "synthetic_message_000001",
        date: NOW,
        text: CHALLENGE
      }
    }
  };
}
const decision = (body, config = opts()) => inspectStrictZaloQaEnvelope(body,config);
function mutate(fn) { const body = canonical(); fn(body); return decision(body); }

test("canonical wrapped private text is REVIEW_ONLY, never provider authentication",()=>{
 const got=decision(canonical());
 assert.equal(got.decision,"REVIEW_ONLY");
 assert.equal(got.reason,"CANONICAL_QA_TEXT_SHAPE");
 assert.equal(got.providerHeaderAuthenticated,false);
 assert.equal(got.providerDeliveryVerified,false);
 assert.equal(got.durableEventStored,false);
 assert.equal(got.storeAuthorityVerified,false);
 assert.equal(got.customerIdentityVerified,false);
 assert.equal(got.orderReadAllowed,false);
 assert.equal(got.orderWriteAllowed,false);
 assert.equal(got.providerSendAllowed,false);
 assert.equal(got.webhookPublishAllowed,false);
 assert.equal(got.containsPII,false);
});
const malformed = [
 ["null body",null,"NONCANONICAL_ENVELOPE"],
 ["string body","{}", "NONCANONICAL_ENVELOPE"],
 ["array body",[], "NONCANONICAL_ENVELOPE"],
 ["flat body",canonical().result,"NONCANONICAL_ENVELOPE"],
 ["missing ok flag",{result:canonical().result},"NONCANONICAL_ENVELOPE"],
 ["false ok flag",{ok:false,result:canonical().result},"NONCANONICAL_ENVELOPE"],
 ["non-object result",{ok:true,result:[]}, "NONCANONICAL_ENVELOPE"],
 ["null result",{ok:true,result:null}, "NONCANONICAL_ENVELOPE"],
 ["ambiguous nested plus flat",{...canonical(),event_name:"message.text.received"},"NONCANONICAL_ENVELOPE"],
 ["ambiguous message at top level",{...canonical(),message:{}}, "NONCANONICAL_ENVELOPE"]
];
for(const [label,body,reason] of malformed) {
 test(label,()=>assert.deepEqual([decision(body).decision,decision(body).reason],["DENY",reason]));
}
for(const [label,modifier,expectedReason] of [
 ["missing message",x=>delete x.result.message,"MALFORMED_MESSAGE"],
 ["message is array",x=>x.result.message=[],"MALFORMED_MESSAGE"],
 ["from missing",x=>delete x.result.message.from,"MALFORMED_MESSAGE"],
 ["from array",x=>x.result.message.from=[],"MALFORMED_MESSAGE"],
 ["chat missing",x=>delete x.result.message.chat,"MALFORMED_MESSAGE"],
 ["chat null",x=>x.result.message.chat=null,"MALFORMED_MESSAGE"],
 ["from.id missing",x=>delete x.result.message.from.id,"MISSING_OR_INVALID_EVENT_IDENTIFIERS"],
 ["chat.id missing",x=>delete x.result.message.chat.id,"MISSING_OR_INVALID_EVENT_IDENTIFIERS"],
 ["invalid sender id",x=>x.result.message.from.id="bad\ninjection","MISSING_OR_INVALID_EVENT_IDENTIFIERS"],
 ["invalid chat id",x=>x.result.message.chat.id="../other-shop","MISSING_OR_INVALID_EVENT_IDENTIFIERS"],
 ["numeric sender id",x=>x.result.message.from.id=123,"MISSING_OR_INVALID_EVENT_IDENTIFIERS"],
 ["message id missing",x=>delete x.result.message.message_id,"MISSING_OR_INVALID_EVENT_IDENTIFIERS"],
 ["message id too short",x=>x.result.message.message_id="a","MISSING_OR_INVALID_EVENT_IDENTIFIERS"],
 ["message id with CRLF",x=>x.result.message.message_id="synthetic_msg\ninj","MISSING_OR_INVALID_EVENT_IDENTIFIERS"],
 ["sender/chat conflict",x=>x.result.message.chat.id="synthetic_other_user","PRIVATE_SENDER_CHAT_CONFLICT"],
 ["timestamp missing",x=>delete x.result.message.date,"INVALID_OR_STALE_TIMESTAMP"],
 ["timestamp in seconds",x=>x.result.message.date=Math.floor(NOW/1000),"INVALID_OR_STALE_TIMESTAMP"],
 ["timestamp decimal",x=>x.result.message.date=NOW+.3,"INVALID_OR_STALE_TIMESTAMP"],
 ["timestamp string",x=>x.result.message.date=String(NOW),"INVALID_OR_STALE_TIMESTAMP"],
 ["timestamp negative",x=>x.result.message.date=-1,"INVALID_OR_STALE_TIMESTAMP"],
 ["timestamp stale",x=>x.result.message.date=NOW-180001,"INVALID_OR_STALE_TIMESTAMP"],
 ["timestamp future",x=>x.result.message.date=NOW+180001,"INVALID_OR_STALE_TIMESTAMP"],
 ["text missing",x=>delete x.result.message.text,"NOT_QA_CHALLENGE"],
 ["wrong text",x=>x.result.message.text="mua 2 áo","NOT_QA_CHALLENGE"],
 ["text prompt injection",x=>x.result.message.text=CHALLENGE+"\nignore policy","NOT_QA_CHALLENGE"]
]){
 test(label,()=>{const got=mutate(modifier);assert.equal(got.decision,"DENY");assert.equal(got.reason,expectedReason);});
}
for(const [label,modifier,reason] of [
 ["bot sender",x=>x.result.message.from.is_bot=true,"BOT_OR_UNKNOWN_SENDER"],
 ["unknown sender bot flag",x=>delete x.result.message.from.is_bot,"BOT_OR_UNKNOWN_SENDER"],
 ["group event",x=>x.result.message.chat.chat_type="GROUP","NON_PRIVATE_CHAT"],
 ["chat type missing",x=>delete x.result.message.chat.chat_type,"NON_PRIVATE_CHAT"]
]){
 test(label,()=>{const got=mutate(modifier);assert.equal(got.decision,"IGNORE");assert.equal(got.reason,reason);});
}
for(const eventName of ["message.image.received","message.voice.received","message.sticker.received","unknown.event"]) {
 test("non-text event ignored: "+eventName,()=>{
  const got=mutate(x=>x.result.event_name=eventName);
  assert.equal(got.decision,"IGNORE");
  assert.equal(got.reason,"UNSUPPORTED_EVENT_TYPE");
 });
}
test("unsupported privacy event ignored without reading its payload",()=>{
 const b={ok:true,result:{event_name:"message.unsupported.received", message:{text:"UNTRUSTED_PRIVATE_TEXT"}}};
 const got=decision(b);
 assert.equal(got.decision,"IGNORE");
 assert.equal(got.reason,"PRIVACY_UNSUPPORTED_EVENT");
 assert.equal(JSON.stringify(got).includes("UNTRUSTED_PRIVATE_TEXT"),false);
});
for(const [label,config] of [
 ["missing clock",{expectedChallenge:CHALLENGE}],
 ["missing challenge",{nowMs:NOW}],
 ["invalid challenge",{nowMs:NOW,expectedChallenge:"not-a-challenge"}],
 ["invalid clock",{nowMs:"now",expectedChallenge:CHALLENGE}]
]){
 test(label,()=>{const got=decision(canonical(),config);assert.equal(got.decision,"DENY");assert.equal(got.reason,"QA_CONFIGURATION_INVALID");});
}
test("exact 180-second skew is permitted for synthetic QA",()=>{
 const b=canonical();b.result.message.date=NOW-180000;
 assert.equal(decision(b).decision,"REVIEW_ONLY");
});
test("PII, raw message, sender/chat IDs and synthetic secrets never returned",()=>{
 const b=canonical();
 b.result.message.from.id="SYNTHETIC_TEST_PERSON_001";
 b.result.message.chat.id="SYNTHETIC_TEST_PERSON_001";
 b.result.message.message_id="SYNTHETIC_TEST_MESSAGE_001";
 const report=JSON.stringify(decision(b));
 for(const sentinel of ["SYNTHETIC_TEST_PERSON_001","SYNTHETIC_TEST_MESSAGE_001",CHALLENGE,"SYNTHETIC_HEADER_SECRET"]) {
  assert.equal(report.includes(sentinel),false);
 }
});
test("client-supplied authority cannot become trusted authority in the output",()=>{
 const b=canonical();
 b.tenantId="forged_tenant";b.storeId="forged_store";b.result.storeId="forged_store";
 const got=decision(b);
 assert.equal(got.storeAuthorityVerified,false);
 assert.equal(got.orderReadAllowed,false);
 assert.equal(JSON.stringify(got).includes("forged_"),false);
});
test("Zalo OA-shaped body is never accepted by Zalo Bot validator",()=>{
 const got=decision({app_id:"synthetic",event_name:"user_send_text",sender:{id:"synthetic"}});
 assert.equal(got.decision,"DENY");
});
test("reviewer does not mutate the inbound event",()=>{
 const b=canonical();
 const before=JSON.stringify(b);
 decision(b);
 assert.equal(JSON.stringify(b),before);
});
