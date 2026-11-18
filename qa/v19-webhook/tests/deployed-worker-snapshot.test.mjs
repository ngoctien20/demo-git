// V19.0-B2 OFFLINE regression of the EXACT Cloudflare-deployed Worker source snapshot.
// No Cloudflare/n8n/provider HTTP requests, no real secrets or real user identifiers.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { handleDedicatedQaWebhook } from "../source-snapshot/v1723u-worker-deployed.mjs";

const SOURCE = readFileSync(new URL("../source-snapshot/v1723u-worker-deployed.mjs", import.meta.url), "utf8");
const NOW = 1795000000000; // Synthetic fixed time; never read actual provider clocks
const PATH = "/qa/zalo-bot/" + "a".repeat(32);
const SECRET = "SYNTHETIC_HEADER_SECRET_" + "s".repeat(32);
const PEPPER = "SYNTHETIC_EVENT_PEPPER_" + "p".repeat(32);
const CHALLENGE = "TIEN404-QA-" + "x".repeat(32);

class FakeD1 {
  constructor({ failure = null } = {}) {
    this.failure = failure;
    this.rows = 0;
    this.attempts = 0;
    this.changes = [];
    this.eventHmac = null;
  }
  prepare(sql) {
    assert.match(sql, /INSERT OR IGNORE INTO qa_canary_once/);
    return {
      bind: (hmac, when) => ({
        run: async () => {
          this.attempts++;
          if (this.failure === "throw") throw new Error("SYNTHETIC_D1_UNAVAILABLE");
          if (this.failure === "false") return { success: false, meta: { changes: 0 } };
          if (this.failure === "missing_meta") return { success: true };
          if (this.rows === 0) {
            this.rows++;
            this.eventHmac = hmac;
            this.changes.push({ when, inserted: true });
            return { success: true, meta: { changes: 1 } };
          }
          this.changes.push({ when, inserted: false });
          return { success: true, meta: { changes: 0 } };
        }
      })
    };
  }
}

function eventBody({ flat = false } = {}) {
  const result = {
    event_name: "message.text.received",
    message: {
      from: { id: "synthetic_sender_0001", is_bot: false },
      chat: { id: "synthetic_sender_0001", chat_type: "PRIVATE" },
      text: CHALLENGE,
      message_id: "synthetic_message_0000001",
      date: NOW
    }
  };
  return flat ? result : { ok: true, result };
}
const clone = (v = eventBody()) => structuredClone(v);
function makeEnv(db = new FakeD1(), overrides = {}) {
  return {
    QA_CANARY_MODE: "OWNER_SCOPED_PRIVATE_NO_SEND_ONCE",
    QA_CALLBACK_PATH: PATH,
    QA_START_MS: String(NOW - 60_000),
    QA_END_MS: String(NOW + 60_000),
    QA_HEADER_SECRET: SECRET,
    QA_EVENT_PEPPER: PEPPER,
    QA_CHALLENGE: CHALLENGE,
    QA_EVENT_DB: db,
    ...overrides
  };
}
function request({
  body = eventBody(),
  raw,
  path = PATH,
  method = "POST",
  secret = SECRET,
  contentType = "application/json",
  userAgent = "V19_SYNTHETIC_QA"
} = {}) {
  const headers = { "x-bot-api-secret-token": secret, "content-type": contentType, "user-agent": userAgent };
  const url = "https://isolated-worker.invalid" + path;
  const opts = { method, headers };
  if (!["GET", "HEAD"].includes(method)) opts.body = raw === undefined ? JSON.stringify(body) : raw;
  return new Request(url, opts);
}
async function execute(options = {}) {
  const db = options.db || new FakeD1();
  const env = makeEnv(db, options.env);
  const req = request(options.request);
  const res = await handleDedicatedQaWebhook(req, env, options.now ?? NOW);
  return { db, res, status: res.status };
}

test("source snapshot exists and is a one-shot QA receiver, not a Commerce ingress", () => {
  assert.ok(SOURCE.includes("export async function handleDedicatedQaWebhook"));
  assert.ok(SOURCE.includes("INSERT OR IGNORE INTO qa_canary_once"));
  assert.ok(SOURCE.includes("slot TEXT PRIMARY KEY CHECK"));
  assert.ok(!SOURCE.includes("await fetch(")); // no outbound provider send in current snapshot
  assert.ok(!SOURCE.includes("setWebhook"));
});
test("historical source comment calls itself V17.23S, not the V17.23U deployment annotation", () => {
  assert.match(SOURCE, /TIEN404 V17\.23S/);
});
test("canonical wrapped POST is accepted after exactly one durable synthetic insert", async () => {
  const { db, res, status } = await execute();
  assert.equal(status, 200);
  assert.equal(await res.text(), "");
  assert.equal(db.rows, 1);
  assert.equal(db.attempts, 1);
  assert.match(db.eventHmac, /^[0-9a-f]{64}$/);
  assert.equal(JSON.stringify(db).includes("synthetic_sender_0001"), false);
  assert.equal(JSON.stringify(db).includes(CHALLENGE), false);
});
test("duplicate canonical event returns empty 200 but does not write a second row", async () => {
  const db = new FakeD1(), env = makeEnv(db);
  for (let i=0;i<2;i++) {
    const res = await handleDedicatedQaWebhook(request(),env,NOW);
    assert.equal(res.status,200);
    assert.equal(await res.text(),"");
  }
  assert.equal(db.rows,1);
  assert.equal(db.attempts,2);
  assert.deepEqual(db.changes.map(x=>x.inserted),[true,false]);
});
test("second distinct event is ALSO not stored because legacy D1 slot is global ONE", async () => {
  const db = new FakeD1(), env = makeEnv(db);
  const second = clone();
  second.result.message.message_id = "synthetic_message_0000002";
  assert.equal((await handleDedicatedQaWebhook(request(),env,NOW)).status,200);
  assert.equal((await handleDedicatedQaWebhook(request({body:second}),env,NOW)).status,200);
  assert.equal(db.rows,1); // KNOWN GAP: not general per-installation event dedupe
});
test("D1 throws -> explicit 503, never a success ACK", async () => {
  const {status}=await execute({db:new FakeD1({failure:"throw"})});
  assert.equal(status,503);
});
test("D1 signals failure -> 503", async () => {
  const {status}=await execute({db:new FakeD1({failure:"false"})});
  assert.equal(status,503);
});
test("D1 success without changes metadata -> 503", async () => {
  const {status}=await execute({db:new FakeD1({failure:"missing_meta"})});
  assert.equal(status,503);
});
test("GET on an unknown path -> 404", async () => {
  assert.equal((await execute({request:{method:"GET",path:"/"}})).status,404);
});
test("GET on exact callback -> 405", async () => {
  assert.equal((await execute({request:{method:"GET"}})).status,405);
});
test("URL query string -> 404", async () => {
  assert.equal((await execute({request:{path:PATH+"?debug=1"}})).status,404);
});
test("wrong callback path -> 404", async () => {
  assert.equal((await execute({request:{path:"/qa/zalo-bot/"+"b".repeat(32)}})).status,404);
});
test("QA canary mode off -> 404", async () => {
  assert.equal((await execute({env:{QA_CANARY_MODE:"DISABLED"}})).status,404);
});
test("malformed configured path -> 503", async () => {
  assert.equal((await execute({env:{QA_CALLBACK_PATH:"/x"}})).status,503);
});
const timing = [
  ["window not started",{QA_START_MS:String(NOW+1)},410],
  ["window already ended",{QA_END_MS:String(NOW-1)},410],
  ["window longer than 30 minutes",{QA_END_MS:String(NOW+1_900_000)},410],
  ["window zero duration",{QA_START_MS:String(NOW),QA_END_MS:String(NOW)},410],
  ["invalid start timestamp",{QA_START_MS:"not-an-integer"},410]
];
for (const [label, env, expected] of timing) {
  test(label, async () => assert.equal((await execute({env})).status,expected));
}
test("wrong header secret -> 403 and no D1 write", async () => {
  const {status,db}=await execute({request:{secret:"attacker"}});
  assert.equal(status,403);
  assert.equal(db.attempts,0);
});
test("missing header secret -> 403", async () => {
  assert.equal((await execute({request:{secret:""}})).status,403);
});
test("invalid configured secret shape is fail-closed", async () => {
  assert.equal((await execute({env:{QA_HEADER_SECRET:"tiny"}})).status,403);
});
test("bad challenge configuration -> 503", async () => {
  assert.equal((await execute({env:{QA_CHALLENGE:"bad"}})).status,503);
});
test("missing D1 binding -> 503", async () => {
  assert.equal((await execute({env:{QA_EVENT_DB:null}})).status,503);
});
test("wrong content type -> 415", async () => {
  assert.equal((await execute({request:{contentType:"text/plain"}})).status,415);
});
test("content-type multipart is not accepted -> 415", async () => {
  assert.equal((await execute({request:{contentType:"multipart/form-data"}})).status,415);
});
test("application/json charset UTF-8 accepted", async () => {
  assert.equal((await execute({request:{contentType:"application/json; charset=UTF-8"}})).status,200);
});
test("empty body -> 400", async () => {
  assert.equal((await execute({request:{raw:""}})).status,400);
});
test("malformed JSON -> 400", async () => {
  assert.equal((await execute({request:{raw:'{"ok":true,'}})).status,400);
});
test("invalid UTF-8 -> 400", async () => {
  const {status}=await execute({request:{raw:new Uint8Array([0xff,0xfe])}});
  assert.equal(status,400);
});
test("oversized JSON payload -> 413", async () => {
  const huge=eventBody();
  huge.padding="z".repeat(9000);
  assert.equal((await execute({request:{body:huge}})).status,413);
});
for(const [label,body,status] of [
  ["null envelope",null,422],
  ["array envelope",[],422],
  ["missing nested result",{},422],
  ["false success flag",{ok:false,result:eventBody().result},422],
  ["ambiguous result plus flat keys",{ok:true,result:eventBody().result,event_name:"message.text.received"},422],
  ["invalid nested event",{ok:true,result:{event_name:"message.text.received"}},422],
  ["unsupported image event",{ok:true,result:{...eventBody().result,event_name:"message.image.received"}},422],
  ["privacy unsupported event",{ok:true,result:{...eventBody().result,event_name:"message.unsupported.received"}},422]
]){
 test(label,async()=>assert.equal((await execute({request:{body}})).status,status));
}
test("group chat denied -> 422", async () => {
  const body=clone();body.result.message.chat.chat_type="GROUP";
  assert.equal((await execute({request:{body}})).status,422);
});
test("bot sender denied -> 422", async () => {
  const body=clone();body.result.message.from.is_bot=true;
  assert.equal((await execute({request:{body}})).status,422);
});
test("missing sender bot flag denied -> 422", async () => {
  const body=clone();delete body.result.message.from.is_bot;
  assert.equal((await execute({request:{body}})).status,422);
});
test("wrong challenge denied -> 422", async () => {
  const body=clone();body.result.message.text="not-the-challenge";
  assert.equal((await execute({request:{body}})).status,422);
});
test("short message ID denied -> 422", async () => {
  const body=clone();body.result.message.message_id="short";
  assert.equal((await execute({request:{body}})).status,422);
});
test("stale timestamp denied -> 422", async () => {
  const body=clone();body.result.message.date=NOW-180_001;
  assert.equal((await execute({request:{body}})).status,422);
});
test("timestamp in seconds denied -> 422", async () => {
  const body=clone();body.result.message.date=Math.floor(NOW/1000);
  assert.equal((await execute({request:{body}})).status,422);
});
test("Java HTTP User-Agent alone is not denied by Worker source", async () => {
  const {status}=await execute({request:{userAgent:"Java/1.8.0_192"}});
  assert.equal(status,200); // NO CLAIM about Cloudflare WAF, TLS or provider reachability
});
test("KNOWN GAP: flat payload is admitted by the deployed snapshot", async () => {
  const {status}=await execute({request:{body:eventBody({flat:true})}});
  assert.equal(status,200); // documents drift from official {ok:true,result:{...}} shape
});
test("KNOWN GAP: source accepts a message missing from.id and chat.id", async () => {
  const body=clone();
  delete body.result.message.from.id;
  delete body.result.message.chat.id;
  const {status}=await execute({request:{body}});
  assert.equal(status,200); // strict QA parser separately rejects
});
test("KNOWN GAP: no rate-limit status or timeout guard in old worker source", () => {
  assert.equal(/\b429\b/.test(SOURCE),false);
  assert.equal(/AbortController|setTimeout|AbortSignal\.timeout/.test(SOURCE),false);
});
test("a Zalo OA-looking callback does not match Zalo Bot event contract", async () => {
  const body={app_id:"synthetic",event_name:"user_send_text",sender:{id:"test"}};
  assert.equal((await execute({request:{body}})).status,422);
});
