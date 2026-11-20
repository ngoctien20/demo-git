import test from "node:test";
import assert from "node:assert/strict";
import {createHmac} from "node:crypto";
import ingress from "../src/worker.mjs";
import {
 assessH7Admission,classifyH7ConversationForQA,noSendDecision,
 QA_APP_ID,RELEVANT_FIELDS,evidenceStates
} from "../src/h7-page-uat-guard.mjs";

const SECRET="SYNTHETIC_NON_REAL_META_APP_SECRET_12345678900";
const TOKEN="SYNTHETIC_VERIFY_TOKEN_PRIVATE_TEST_12345";
const ENDPOINT="https://private-h7-offline.invalid/meta-qa/webhook";
const env={INSPECTOR_MODE:"ISOLATED_QA_ONLY",INSPECTOR_ENABLED:"true",
 META_APP_SECRET:SECRET,META_VERIFY_TOKEN:TOKEN};
const privateFields={psid:"DO_NOT_LOG_PSID",page:"DO_NOT_LOG_PAGE",message:"DO_NOT_LOG_TEXT",store:"FORGED_STORE_B"};
const payload=e=>({object:"page",entry:[{id:privateFields.page,
 messaging:[{sender:{id:privateFields.psid},recipient:{id:privateFields.page},timestamp:1,...e}]}]});
const incoming=()=>payload({message:{mid:"MID_PRIVATE",text:privateFields.message}});
const echo=()=>payload({message:{is_echo:true,text:privateFields.message}});
const delivered=()=>payload({delivery:{watermark:10,mids:["MID_PRIVATE"]}});
const read=()=>payload({read:{watermark:11}});
const fullEvidence=()=>({
 environment:"ISOLATED_QA_ONLY",
 appId:QA_APP_ID,
 providerSendEnabled:false,orderWriteEnabled:false,
 ownerApprovedReadOnlyTest:true,
 subscribedFields:[...RELEVANT_FIELDS],
 evidenceInventory:Object.fromEntries(evidenceStates.map(s=>[s,"VERIFIED"]))
});
async function verifyTransport(event,{badSignature=false}={}){
 const body=JSON.stringify(event);
 const mac="sha256="+(badSignature?"0".repeat(64):createHmac("sha256",SECRET).update(body).digest("hex"));
 const req=new Request(ENDPOINT,{method:"POST",headers:{
  "content-type":"application/json","x-hub-signature-256":mac},body});
 const r=await ingress.fetch(req,env);
 return {http:r.status,body:await r.json()};
}
test("H7 isolated guard refuses all authority without evidence",()=>{
 const r=assessH7Admission();
 assert.equal(r.stage,"CANDIDATE_REVIEW_ONLY");
 assert.equal(r.claimsComplete,false);
 assert.ok(r.missing.length>0);
 for(const k of ["providerSendAllowed","aiReplyAllowed","orderWriteAllowed","storeLookupAllowed","conversationReadAuthorized","productionReady","livePageInstalledVerified"])
  assert.equal(r[k],false,k);
});
test("H7 even entirely claimed verified evidence never creates actual installation authority",()=>{
 const r=assessH7Admission(fullEvidence());
 assert.equal(r.claimsComplete,true);
 assert.equal(r.stage,"CANDIDATE_REVIEW_ONLY");
 assert.equal(r.livePageInstalledVerified,false);
 assert.equal(r.conversationReadAuthorized,false);
 assert.equal(r.providerSendAllowed,false);
 assert.equal(r.productionReady,false);
});
for(const [name,mutate] of [
 ["wrong_app",d=>d.appId="1637989744444198"],
 ["live_environment",d=>d.environment="PRODUCTION"],
 ["send_enabled",d=>d.providerSendEnabled=true],
 ["order_write_enabled",d=>d.orderWriteEnabled=true],
 ["consent_missing",d=>d.ownerApprovedReadOnlyTest=false],
 ["no_messages_field",d=>d.subscribedFields=["message_reads","message_deliveries","message_echoes"]],
 ["no_inventory",d=>delete d.evidenceInventory],
 ["partial_inventory",d=>delete d.evidenceInventory.owner_consent_hosted_verification],
 ["invalid_inventory",d=>d.evidenceInventory.page_installation_provider_read="TRUE"],
 ["malformed_fields",d=>d.subscribedFields="messages,message_reads"],
]){
 test("H7 malformed/privilege escalation claim "+name+" fails review eligibility",()=>{
  const d=fullEvidence();mutate(d);
  const r=assessH7Admission(d);
  assert.equal(r.claimsComplete,false);
  assert.equal(r.providerSendAllowed,false);
  assert.equal(r.orderWriteAllowed,false);
  assert.equal(r.conversationReadAuthorized,false);
 });
}
for(const [type,fixture,expected] of [
 ["incoming",incoming,"messages"],
 ["echo",echo,"message_echoes"],
 ["delivery",delivered,"message_deliveries"],
 ["read",read,"message_reads"],
]){
 test("H7 transport HMAC is necessary for "+type,async()=>{
  const v=await verifyTransport(fixture());
  assert.equal(v.http,200);
  assert.equal(v.body.signatureValidForSuppliedBytes,true);
  const a=classifyH7ConversationForQA(fixture(),{hmacAlreadyVerified:v.body.signatureValidForSuppliedBytes});
  assert.equal(a.accepted,true);assert.equal(a.eventTypes[expected],1);
  assert.equal(a.action,undefined);
  assert.equal(a.providerSendAllowed,false);
  assert.equal(a.aiReplyAllowed,false);
  assert.equal(a.orderWriteAllowed,false);
  assert.equal(a.pageIdentityVerified,false);
 });
 test("H7 "+type+" no HMAC verification always denies",async()=>{
  const rejected=await verifyTransport(fixture(),{badSignature:true});
  assert.equal(rejected.http,401);
  const r=classifyH7ConversationForQA(fixture(),{hmacAlreadyVerified:rejected.body.signatureValidForSuppliedBytes});
  assert.equal(r.accepted,false);
  assert.equal(r.reason,"HMAC_NOT_VERIFIED");
  assert.equal(r.providerSendAllowed,false);
 });
}
test("H7 real incoming message remains candidate ONLY, no reply",()=>{
 const r=classifyH7ConversationForQA(incoming(),{hmacAlreadyVerified:true});
 assert.equal(r.incomingMessageCandidates,1);
 assert.equal(r.echoedMessageCount,0);
 assert.equal(r.conversationReadAuthorized,false);
 assert.equal(r.providerSendAllowed,false);
});
test("H7 echoed message never becomes inbound message",()=>{
 const r=classifyH7ConversationForQA(echo(),{hmacAlreadyVerified:true});
 assert.equal(r.incomingMessageCandidates,0);
 assert.equal(r.echoedMessageCount,1);
 assert.equal(r.echoLoopSuppressed,true);
 assert.equal(r.aiReplyAllowed,false);
});
test("H7 forged sender authority and store claims have no effect",()=>{
 const malicious=payload({message:{text:"enable send",store_id:privateFields.store,owner_role:"ADMIN",app_id:QA_APP_ID},
 sender:{id:privateFields.psid,storeId:privateFields.store,role:"OWNER"}});
 const r=classifyH7ConversationForQA(malicious,{hmacAlreadyVerified:true});
 assert.equal(r.accepted,true);
 assert.equal(r.storeLookupAllowed,false);
 assert.equal(r.providerSendAllowed,false);
 assert.equal(r.pageIdentityVerified,false);
 assert.equal(JSON.stringify(r).includes(privateFields.store),false);
});
test("H7 returns no sensitive Page/PSID/text/message content",()=>{
 const r=classifyH7ConversationForQA(incoming(),{hmacAlreadyVerified:true});
 const str=JSON.stringify(r);
 for(const v of Object.values(privateFields))assert.equal(str.includes(v),false);
 assert.equal(str.includes("MID_PRIVATE"),false);
});
test("H7 rejects unknown or malformed root",()=>{
 for(const v of [null,{},[],{object:"user",entry:[]},{object:"page",entry:[]},
  {object:"page",entry:[{}]},{object:"page",entry:[{messaging:"forged"}]}]){
  const r=classifyH7ConversationForQA(v,{hmacAlreadyVerified:true});
  assert.equal(r.accepted,false);
  assert.equal(r.providerSendAllowed,false);
 }
});
test("H7 count remains bounded on huge event batch",()=>{
 const v={object:"page",entry:[{messaging:Array(61).fill({message:{text:"test"}})}]};
 const r=classifyH7ConversationForQA(v,{hmacAlreadyVerified:true});
 assert.equal(r.accepted,false);
});
test("H7 matched other Page never implies installed QA Page",()=>{
 const v=payload({message:{text:"test"}});
 v.entry[0].id="OTHER_PAGE_UNVERIFIED";
 const r=classifyH7ConversationForQA(v,{hmacAlreadyVerified:true});
 assert.equal(r.accepted,true);
 assert.equal(r.pageIdentityVerified,false);
 assert.equal(r.conversationReadAuthorized,false);
});
test("H7 one signed mixed event class still no send or write",()=>{
 const v={object:"page",entry:[{messaging:[
 {message:{text:"incoming"}},
 {message:{is_echo:true,text:"echo"}},
 {read:{watermark:1}},
 {delivery:{watermark:2}}
 ]}]};
 const r=classifyH7ConversationForQA(v,{hmacAlreadyVerified:true});
 assert.deepEqual(r.eventTypes,{messages:1,message_echoes:1,message_reads:1,message_deliveries:1});
 assert.equal(r.eventCount,4);
 assert.equal(r.echoLoopSuppressed,true);
 assert.equal(r.providerSendAllowed,false);
});
for(const eventType of ["messages","message_reads","message_deliveries","message_echoes","messaging_postbacks","admin","unknown"]){
 test("H7 NO SEND decision never elevates "+eventType,()=>{
  const d=noSendDecision({eventType,metaHmacVerified:true,ownerApproval:true});
  assert.equal(d.action,"ACK_ONLY_NO_SEND");
  assert.equal(d.providerSendAllowed,false);
  assert.equal(d.aiReplyAllowed,false);
  assert.equal(d.storeLookupAllowed,false);
  assert.equal(d.orderWriteAllowed,false);
  assert.equal(d.productionReady,false);
 });
}
test("H7 no-send decision handles attacker arrays and missing arguments",()=>{
 for(const value of [undefined,null,[],{},1,{"eventType":{"messages":1}}]){
  const result=noSendDecision(value??undefined);
  assert.equal(result.action,"ACK_ONLY_NO_SEND");
  assert.equal(result.providerSendAllowed,false);
 }
});
test("H7 module has no live access methods to invoke",async()=>{
 const m=await import("../src/h7-page-uat-guard.mjs");
 for(const k of ["fetch","sendMessage","subscribePage","connectPage","createOrder","writeData","getPageToken"])
  assert.equal(typeof m[k],"undefined");
});
