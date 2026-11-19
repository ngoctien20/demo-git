import test from "node:test";
import assert from "node:assert/strict";
import {createHmac} from "node:crypto";
import worker from "../src/worker.mjs";

const HOST="https://isolated-qa.invalid/meta-qa/webhook";
const APP_SECRET="SYNTHETIC_QA_SECRET_DO_NOT_USE_LIVE_123456";
const VERIFY_TOKEN="SYNTHETIC_QA_VERIFY_TOKEN_DO_NOT_USE_LIVE";
const qaEnv=Object.freeze({
 INSPECTOR_ENABLED:"true",INSPECTOR_MODE:"ISOLATED_QA_ONLY",
 META_APP_SECRET:APP_SECRET,META_VERIFY_TOKEN:VERIFY_TOKEN
});
const postback={object:"page",entry:[{id:"SYNTHETIC_PAGE_ID",changes:[{field:"messaging_postbacks",value:{
 sender:{id:"SYNTHETIC_USER"},recipient:{id:"SYNTHETIC_PAGE"},
 postback:{payload:"SYNTHETIC_ACTION_NO_ORDER"}
}}]}]};
async function invoke(method,path=HOST,env=qaEnv,options={}){
 return worker.fetch(new Request(path,{method,...options}),env);
}
function signed(obj=postback,secret=APP_SECRET){
 const body=JSON.stringify(obj),signature=createHmac("sha256",secret).update(body).digest("hex");
 return {body,headers:{"Content-Type":"application/json","X-Hub-Signature-256":"sha256="+signature}};
}
const challengeURL=(token=VERIFY_TOKEN)=>HOST+"?"+new URLSearchParams({
 "hub.mode":"subscribe","hub.verify_token":token,"hub.challenge":"12345"
}).toString();

test("H2 default deployment flag false fails closed on GET",async()=>{
 const r=await invoke("GET",challengeURL(),{...qaEnv,INSPECTOR_ENABLED:"false"});
 assert.equal(r.status,503);assert.equal((await r.json()).canSend,false);
});
test("H2 disabled flag false fails closed on POST even if HMAC valid",async()=>{
 const r=await invoke("POST",HOST,{...qaEnv,INSPECTOR_ENABLED:"false"},signed());
 assert.equal(r.status,503);assert.equal((await r.json()).canWrite,false);
});
test("H2 no Meta Verify Token bound denies GET",async()=>{
 const {META_VERIFY_TOKEN,...env}=qaEnv;
 assert.equal((await invoke("GET",challengeURL(),env)).status,403);
});
test("H2 no Meta App Secret bound denies POST",async()=>{
 const {META_APP_SECRET,...env}=qaEnv;
 assert.equal((await invoke("POST",HOST,env,signed())).status,401);
});
test("H2 wrong Meta Verify Token rejected",async()=>{
 assert.equal((await invoke("GET",challengeURL("WRONG_TEST_SECRET"))).status,403);
});
test("H2 correct QA-only token returns exact challenge, not token",async()=>{
 const r=await invoke("GET",challengeURL());
 assert.equal(r.status,200);assert.equal(await r.text(),"12345");
 assert.equal(r.headers.get("cache-control"),"no-store");
});
test("H2 signed QA-only postback is ACK-only without downstream effect",async()=>{
 const r=await invoke("POST",HOST,qaEnv,signed());
 assert.equal(r.status,200);
 const b=await r.json();
 assert.equal(b.status,"ACK_ONLY_NO_SEND");
 assert.deepEqual(b.eventTypes,{messaging_postbacks:1});
 assert.equal(b.canSend,false);assert.equal(b.canWrite,false);
 assert.equal(b.storeVerified,false);assert.equal(b.actualMetaDeliveryVerified,false);
});
test("H2 wrong App Secret signature fails",async()=>{
 const r=await invoke("POST",HOST,qaEnv,signed(postback,"SYNTHETIC_WRONG_SECRET_LONG_ENOUGH_123"));
 assert.equal(r.status,401);
});
test("H2 tampering signed bytes fails",async()=>{
 const raw=signed(),wrongBody=raw.body.replace("SYNTHETIC_ACTION_NO_ORDER","CREATE_REAL_ORDER");
 const r=await invoke("POST",HOST,qaEnv,{body:wrongBody,headers:raw.headers});
 assert.equal(r.status,401);
});
test("H2 replayed sample is non-operational and produces no order",async()=>{
 const a=await invoke("POST",HOST,qaEnv,signed());
 const b=await invoke("POST",HOST,qaEnv,signed());
 assert.equal(a.status,200);assert.equal(b.status,200);
 const x=await a.json(),y=await b.json();
 assert.equal(x.canWrite,false);assert.equal(y.canWrite,false);
 assert.equal(x.canSend,false);assert.equal(y.canSend,false);
});
test("H2 unknown change field redacted",async()=>{
 const bad={object:"page",entry:[{changes:[{field:"SECRET_SENSITIVE_UNKNOWN",value:{message:"PRIVATE"}}]}]};
 const r=await invoke("POST",HOST,qaEnv,signed(bad));
 assert.equal(r.status,200);
 const data=JSON.stringify(await r.json());
 assert.equal(data.includes("SECRET_SENSITIVE_UNKNOWN"),false);
 assert.equal(data.includes("PRIVATE"),false);
});
test("H2 malformed signed JSON denied",async()=>{
 const body="{invalid-json";
 const sig=createHmac("sha256",APP_SECRET).update(body).digest("hex");
 const r=await invoke("POST",HOST,qaEnv,{body,headers:{"content-type":"application/json","x-hub-signature-256":"sha256="+sig}});
 assert.equal(r.status,400);
});
test("H2 no Content-Type refuses JSON POST",async()=>{
 const {headers,body}=signed();delete headers["Content-Type"];
 assert.equal((await invoke("POST",HOST,qaEnv,{headers,body})).status,415);
});
test("H2 non-QA runtime mode never grants access",async()=>{
 const env={...qaEnv,INSPECTOR_MODE:"PRODUCTION"};
 assert.equal((await invoke("GET",challengeURL(),env)).status,503);
});
test("H2 metadata test never emits secrets or Page IDs",async()=>{
 const r=await invoke("POST",HOST,qaEnv,signed());
 const result=JSON.stringify(await r.json());
 for(const s of [APP_SECRET,VERIFY_TOKEN,"SYNTHETIC_PAGE_ID","SYNTHETIC_USER","SYNTHETIC_ACTION_NO_ORDER"]){
  assert.equal(result.includes(s),false);
 }
});
