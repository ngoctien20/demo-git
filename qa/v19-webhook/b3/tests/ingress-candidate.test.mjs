import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import candidate, { handleB3OfflineQa, readBoundedBody, RATE_SQL, EVENT_SQL } from "../ingress-candidate.mjs";

const NOW = 1795000000000;
const PATH = "/qa/zalo-bot/" + "a".repeat(32);
const SECRET = "SYNTHETIC_AUTH_SECRET_" + "s".repeat(40);
const PEPPER = "SYNTHETIC_HMAC_KEY_" + "p".repeat(40);
const CHALLENGE = "TIEN404-QA-" + "x".repeat(32);
const INSTALL_A = "qa-install-" + "a".repeat(24);
const INSTALL_B = "qa-install-" + "b".repeat(24);

function envelope(id = "synthetic-message-000001") {
  return { ok: true, result: { event_name: "message.text.received",
    message: { from: { id: "synthetic-user-000001", is_bot: false },
      chat: { id: "synthetic-user-000001", chat_type: "PRIVATE" },
      message_id: id, date: NOW, text: CHALLENGE } } };
}
const clone = x => structuredClone(x);
function env(db, extra = {}) {
  return { QA_B3_MODE: "OFFLINE_QA_NO_SEND",
    QA_B3_CALLBACK_PATH: PATH, QA_B3_INSTALLATION_ID: INSTALL_A,
    QA_B3_HEADER_SECRET: SECRET, QA_B3_HASH_PEPPER: PEPPER,
    QA_B3_CHALLENGE: CHALLENGE,
    QA_B3_START_MS: NOW - 60_000, QA_B3_END_MS: NOW + 60_000,
    QA_B3_RATE_LIMIT: 5, QA_B3_BODY_TIMEOUT_MS: 100,
    QA_B3_DB: db, ...extra };
}
function makeRequest(body = envelope(), opts = {}) {
  const {path=PATH,secret=SECRET,method="POST",
    contentType="application/json",raw,headers={},duplex}=opts;
  return new Request("https://b3-offline.invalid" + path,{
    method,
    headers:{"x-bot-api-secret-token":secret,"content-type":contentType,...headers},
    ...(!["HEAD","GET"].includes(method)?{
      body:raw===undefined?JSON.stringify(body):raw,
      ...(duplex?{duplex}:{})
    }:{})
  });
}
class FakeD1 {
  constructor() {
    this.rates=new Map();this.events=new Map();this.calls=[];
    this.failRate=false;this.failEvent=false;
    this.malformedRate=false;this.malformedEvent=false;
  }
  prepare(sql) {
    const self=this;
    const kind=sql===RATE_SQL?"rate":sql===EVENT_SQL?"event":null;
    assert.ok(kind,"unknown SQL candidate");
    return {bind(...args){return{async first(){
      self.calls.push(kind);
      if(kind==="rate"){
        if(self.failRate)throw new Error("FAKE_RATE_DB_UNAVAILABLE");
        if(self.malformedRate)return {hits:"untrusted"};
        const [scope,bucket,now,max]=args;
        const key=scope+"|"+bucket;
        const val=self.rates.get(key)||0;
        if(val>=max)return null;
        const hits=val+1;
        self.rates.set(key,hits);
        return {hits};
      }
      if(self.failEvent)throw new Error("FAKE_EVENT_DB_UNAVAILABLE");
      if(self.malformedEvent)return {attempts:"untrusted"};
      const [scope,eventKey,payloadKey,now]=args;
      const key=scope+"|"+eventKey;
      const old=self.events.get(key);
      if(old && old.payload!==payloadKey)return null;
      const attempts=old?old.attempts+1:1;
      self.events.set(key,{scope,eventKey,payload:payloadKey,first:old?.first??now,attempts});
      return {attempts};
    }};}};
  }
}
async function run({db=new FakeD1(),body=envelope(),request={},config={},now=NOW}={}) {
 const result=await handleB3OfflineQa(makeRequest(body,request),env(db,config),now);
 return {status:result.status,result,db};
}

test("default Worker export permanently returns 423, even with valid auth",async()=>{
 const db=new FakeD1();
 const r=await candidate.fetch(makeRequest(),env(db));
 assert.equal(r.status,423);assert.deepEqual(db.calls,[]);
});
test("canonical QA text accepted after rate admission and D1 event claim",async()=>{
 const {status,db,result}=await run();
 assert.equal(status,200);assert.equal(await result.text(),"");
 assert.deepEqual(db.calls,["rate","event"]);
 assert.equal(db.events.size,1);assert.equal(db.rates.size,1);
 const record=[...db.events.values()][0];
 assert.match(record.scope,/^[0-9a-f]{64}$/);
 assert.match(record.eventKey,/^[0-9a-f]{64}$/);
 assert.match(record.payload,/^[0-9a-f]{64}$/);
 assert.equal(JSON.stringify([...db.events.values()]).includes("synthetic-user"),false);
 assert.equal(JSON.stringify([...db.events.values()]).includes(CHALLENGE),false);
});
test("duplicate identical message ACKs 200; one event row, attempts increments",async()=>{
 const db=new FakeD1();
 assert.equal((await run({db})).status,200);
 assert.equal((await run({db})).status,200);
 assert.equal(db.events.size,1);
 assert.equal([...db.events.values()][0].attempts,2);
});
test("same message ID with changed timestamp returns 409 without second row",async()=>{
 const db=new FakeD1(); const altered=envelope();
 assert.equal((await run({db})).status,200);
 altered.result.message.date+=1;
 assert.equal((await run({db,body:altered})).status,409);
 assert.equal(db.events.size,1);
});
test("different message IDs create distinct rows in same installation",async()=>{
 const db=new FakeD1();
 assert.equal((await run({db,body:envelope("synthetic-message-000101")})).status,200);
 assert.equal((await run({db,body:envelope("synthetic-message-000102")})).status,200);
 assert.equal(db.events.size,2);
});
test("SAME message ID in two trusted installations gets two separate rows",async()=>{
 const db=new FakeD1();
 assert.equal((await run({db})).status,200);
 assert.equal((await run({db,config:{QA_B3_INSTALLATION_ID:INSTALL_B}})).status,200);
 assert.equal(db.events.size,2);
 assert.equal(db.rates.size,2);
 assert.notEqual([...db.events.values()][0].scope,[...db.events.values()][1].scope);
});
test("forged installation ID in payload rejected, cannot choose Store authority",async()=>{
 const b=envelope();b.result.installationId=INSTALL_B;b.storeId="forged-store";
 const {status,db}=await run({body:b});
 assert.equal(status,422);assert.equal(db.events.size,0);
});
test("rate limit caps request count, including duplicate retries, per installation",async()=>{
 const db=new FakeD1();
 for(let i=0;i<5;i++)assert.equal((await run({db})).status,200);
 assert.equal((await run({db})).status,429);
 assert.equal(db.events.size,1);
 assert.equal([...db.rates.values()][0],5);
});
test("rate budgets reset on next minute bucket",async()=>{
 const db=new FakeD1();
 const start=Math.floor(NOW/60_000)*60_000;
 for(let i=0;i<2;i++)assert.equal((await run({db,now:start+1,config:{QA_B3_RATE_LIMIT:2}})).status,200);
 assert.equal((await run({db,now:start+1,config:{QA_B3_RATE_LIMIT:2}})).status,429);
 assert.equal((await run({db,now:start+60_001,config:{QA_B3_RATE_LIMIT:2, QA_B3_END_MS:start+120_000}})).status,200);
 assert.equal(db.rates.size,2);
});
test("20 concurrent requests -> only five rate-admitted, NO lost update in fake atomic",async()=>{
 const db=new FakeD1(), all=await Promise.all(
  Array.from({length:20},(_,i)=>run({db,body:envelope("synthetic-message-"+String(100000+i))}))
 );
 assert.equal(all.filter(x=>x.status===200).length,5);
 assert.equal(all.filter(x=>x.status===429).length,15);
 assert.equal(db.events.size,5);
});
test("20 concurrent same-event retries -> exactly one row (within rate limit 20)",async()=>{
 const db=new FakeD1();
 const all=await Promise.all(Array.from({length:20},()=>run({db,config:{QA_B3_RATE_LIMIT:20}})));
 assert.ok(all.every(x=>x.status===200));
 assert.equal(db.events.size,1);
 assert.equal([...db.events.values()][0].attempts,20);
});
test("rate limit has no cross-installation collision",async()=>{
 const db=new FakeD1();
 for(let i=0;i<2;i++) assert.equal((await run({db,config:{QA_B3_RATE_LIMIT:2}})).status,200);
 assert.equal((await run({db,config:{QA_B3_RATE_LIMIT:2}})).status,429);
 assert.equal((await run({db,config:{QA_B3_RATE_LIMIT:2,QA_B3_INSTALLATION_ID:INSTALL_B}})).status,200);
});
test("invalid shared header rejected WITHOUT hitting DB",async()=>{
 const db=new FakeD1();
 assert.equal((await run({db,request:{secret:"wrong"}})).status,403);
 assert.equal(db.calls.length,0);
});
test("missing shared secret rejected",async()=>{
 assert.equal((await run({request:{secret:""}})).status,403);
});
test("GET route rejected before rate budget",async()=>{
 const db=new FakeD1();
 assert.equal((await run({db,request:{method:"GET"}})).status,405);
 assert.equal(db.calls.length,0);
});
test("wrong route rejected without rate consumption",async()=>{
 const db=new FakeD1();
 assert.equal((await run({db,request:{path:"/qa/zalo-bot/"+"b".repeat(32)}})).status,404);
 assert.equal(db.calls.length,0);
});
test("query string on route rejected",async()=>{
 assert.equal((await run({request:{path:PATH+"?mode=unsafe"}})).status,404);
});
test("disabled QA mode hard-locks before any processing",async()=>{
 assert.equal((await run({config:{QA_B3_MODE:"DISABLED"}})).status,423);
});
test("QA window outside boundary rejected",async()=>{
 assert.equal((await run({now:NOW+80_000})).status,410);
});
for(const [label,cfg] of [
 ["missing DB",{QA_B3_DB:null}],
 ["rate limit zero",{QA_B3_RATE_LIMIT:0}],
 ["rate limit unreasonably high",{QA_B3_RATE_LIMIT:9999}],
 ["timeout too high",{QA_B3_BODY_TIMEOUT_MS:99_999}],
 ["timeout not integer",{QA_B3_BODY_TIMEOUT_MS:1.2}],
 ["installation invalid",{QA_B3_INSTALLATION_ID:"not-trusted"}],
 ["window too long",{QA_B3_END_MS:NOW+3_600_000}],
 ["bad hash pepper",{QA_B3_HASH_PEPPER:"x"}],
 ["no shared header secret",{QA_B3_HEADER_SECRET:"x"}]
]){
 test("invalid config fail-closed: "+label,async()=>{
  const db=new FakeD1();
  assert.equal((await run({db,config:cfg})).status,503);
  assert.equal(db.calls.length,0);
 });
}
test("bad content type returns 415 before DB work",async()=>{
 const db=new FakeD1();
 assert.equal((await run({db,request:{contentType:"text/plain"}})).status,415);
 assert.equal(db.calls.length,0);
});
test("malformed JSON -> 400, consumes one rate slot",async()=>{
 const db=new FakeD1();
 assert.equal((await run({db,request:{raw:'{"ok":true,'}})).status,400);
 assert.equal(db.rates.size,1);assert.equal(db.events.size,0);
});
test("Zalo OA callback cannot masquerade as Bot -> 422",async()=>{
 const db=new FakeD1();
 assert.equal((await run({db,body:{event_name:"user_send_text",app_id:"test",sender:{id:"1"}}})).status,422);
 assert.equal(db.events.size,0);
});
test("flat (noncanonical) Zalo text event -> 422",async()=>{
 assert.equal((await run({body:envelope().result})).status,422);
});
test("sender/chat mismatch -> 422",async()=>{
 const b=envelope();b.result.message.chat.id="different_user";
 assert.equal((await run({body:b})).status,422);
});
test("stale timestamp -> 422",async()=>{
 const b=envelope();b.result.message.date-=180_001;
 assert.equal((await run({body:b})).status,422);
});
test("unsupported privacy event -> 422, zero event claims",async()=>{
 const b=envelope();b.result.event_name="message.unsupported.received";
 const {db,status}=await run({body:b});
 assert.equal(status,422);assert.equal(db.events.size,0);
});
test("D1 rate gate failure returns 503, never 200",async()=>{
 const db=new FakeD1();db.failRate=true;
 const {status}=await run({db});assert.equal(status,503);
});
test("D1 event claim failure returns 503, never 200",async()=>{
 const db=new FakeD1();db.failEvent=true;
 const {status}=await run({db});assert.equal(status,503);
});
test("D1 rate missing integer result fail-closed -> 503",async()=>{
 const db=new FakeD1();db.malformedRate=true;
 assert.equal((await run({db})).status,503);
});
test("D1 event missing integer result fail-closed -> 503",async()=>{
 const db=new FakeD1();db.malformedEvent=true;
 assert.equal((await run({db})).status,503);
});
test("Content-Length over limit -> 413 without invoking event claim",async()=>{
 const db=new FakeD1();
 const {status}=await run({db,request:{headers:{"content-length":"9000"}}});
 assert.equal(status,413);assert.equal(db.events.size,0);
});
test("Content-Length noninteger -> 400",async()=>{
 assert.equal((await run({request:{headers:{"content-length":"abc"}}})).status,400);
});
test("streamed byte count, not Content-Length, rejects oversized body",async()=>{
 const db=new FakeD1();
 const body=envelope();body.padding="x".repeat(8300);
 const {status}=await run({db,body});
 assert.equal(status,413);assert.equal(db.events.size,0);
});
test("body stream must have bytes",async()=>{
 const request=new Request("https://test.invalid",{method:"POST",body:""});
 const r=await readBoundedBody(request,{timeoutMs:50});
 assert.equal(r.status,400);
});
test("bounded read rejects a stalled stream on a global deadline",async()=>{
 let canceled=false;
 const stream=new ReadableStream({ start(){},cancel(){canceled=true;} });
 const req=new Request("https://test.invalid",{method:"POST",body:stream,duplex:"half"});
 const begin=performance.now();
 const r=await readBoundedBody(req,{timeoutMs:20});
 assert.equal(r.status,408);
 assert.ok(performance.now()-begin<1500);
 assert.equal(canceled,true);
});
test("valid body reading returns same bytes with bounded buffer",async()=>{
 const request=new Request("https://test.invalid",{method:"POST",body:"abc"});
 const got=await readBoundedBody(request,{timeoutMs:50,maxBytes:3});
 assert.equal(got.status,200);
 assert.equal(new TextDecoder().decode(got.bytes),"abc");
});
test("zero max bytes fails settings closed",async()=>{
 const request=new Request("https://test.invalid",{method:"POST",body:"hi"});
 assert.equal((await readBoundedBody(request,{maxBytes:0})).status,503);
});
test("module cannot send messages or call external network",()=>{
 const src=readFileSync(new URL("../ingress-candidate.mjs",import.meta.url),"utf8");
 assert.equal(/\bfetch\(["']https?:/.test(src),false);
 assert.equal(/\bwaitUntil\s*\(/.test(src),false);
 assert.equal(/\bsetWebhook\s*\(/.test(src),false);
 assert.equal(/\bconsole\.(?:log|error|debug)/.test(src),false);
 assert.match(src,/fetch\(\)\s*\{\s*return response\(423\)/);
});
