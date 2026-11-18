import test from "node:test";
import assert from "node:assert/strict";
import { checkNativeQaEvent, QA_CANARY } from "./native-qa-validator.mjs";

const SECRET = "SYNTHETIC_HEADER_SECRET_NOT_REAL_182";
const KEY = "SYNTHETIC_KEY_DO_NOT_USE_OUTSIDE_TESTS_182";
const NOW = 1795000000000;
const BASE = {
  headers: {
    "X-Bot-Api-Secret-Token": SECRET,
    "content-type": "application/json"
  },
  body: {
    ok: true,
    result: {
      event_name: "message.text.received",
      message: {
        from: { id: "synthetic_sender_a", is_bot: false },
        chat: { id: "synthetic_sender_a", chat_type: "PRIVATE" },
        text: QA_CANARY,
        message_id: "synthetic_msg_00001",
        date: NOW
      }
    }
  },
  expectedSecret: SECRET,
  evidenceKey: KEY,
  nowMs: NOW
};
const clone = () => structuredClone(BASE);
const check = (fn) => {
  const req = clone();
  fn(req);
  return checkNativeQaEvent(req);
};

test("valid syntax only produces candidate metadata, never a hosted admission", () => {
  const got = checkNativeQaEvent(clone());
  assert.equal(got.reason, "CANDIDATE_METADATA_ONLY");
  assert.equal(got.decision, "REVIEW_ONLY");
  assert.match(got.evidenceDigest, /^[a-f0-9]{64}$/);
  for (const key of ["actualZaloDeliveryVerified", "canonicalBotToStoreVerified",
    "durableReplayPersisted", "authorizedToAcknowledgeProvider",
    "authorizedToCallCore", "authorizedToReadOrder", "authorizedToWriteOrder",
    "authorizedToSendMessage", "authorizedToPublishWebhook", "containsPII"]) {
    assert.equal(got[key], false, key);
  }
});

const denyCases = [
  ["missing shared secret", x => { delete x.headers["X-Bot-Api-Secret-Token"]; }, "MISSING_HEADER"],
  ["wrong shared secret", x => { x.headers["X-Bot-Api-Secret-Token"] = "ATTACKER_WRONG"; }, "BAD_HEADER"],
  ["duplicate mixed-case header", x => { x.headers["x-bot-api-secret-token"] = SECRET; }, "MISSING_HEADER"],
  ["array-valued secret", x => { x.headers["X-Bot-Api-Secret-Token"] = [SECRET]; }, "MISSING_HEADER"],
  ["wrong content type", x => { x.headers["content-type"] = "application/x-www-form-urlencoded"; }, "UNSUPPORTED_MEDIA_TYPE"],
  ["missing content type", x => { delete x.headers["content-type"]; }, "UNSUPPORTED_MEDIA_TYPE"],
  ["incorrect server secret", x => { x.expectedSecret = "ANOTHER_CONFIGURED_SECRET"; }, "BAD_HEADER"],
  ["missing server secret", x => { x.expectedSecret = undefined; }, "SERVER_NOT_CONFIGURED"],
  ["missing evidence HMAC key", x => { x.evidenceKey = ""; }, "SERVER_NOT_CONFIGURED"],
  ["invalid server clock", x => { x.nowMs = "now"; }, "SERVER_NOT_CONFIGURED"],
  ["string body", x => { x.body = "not-json"; }, "INVALID_BODY"],
  ["array body", x => { x.body = []; }, "INVALID_BODY"],
  ["not ok", x => { x.body.ok = false; }, "UNSUPPORTED_EVENT"],
  ["wrong nested result", x => { x.body.result = null; }, "UNSUPPORTED_EVENT"],
  ["photo event", x => { x.body.result.event_name = "message.image.received"; }, "UNSUPPORTED_EVENT"],
  ["unsupported protected account event", x => { x.body.result.event_name = "message.unsupported.received"; }, "UNSUPPORTED_EVENT"],
  ["group message", x => { x.body.result.message.chat.chat_type = "GROUP"; }, "MALFORMED_OR_STALE_EVENT"],
  ["bot sender", x => { x.body.result.message.from.is_bot = true; }, "MALFORMED_OR_STALE_EVENT"],
  ["sender/chat mismatch", x => { x.body.result.message.chat.id = "other_sender"; }, "MALFORMED_OR_STALE_EVENT"],
  ["missing sender ID", x => { delete x.body.result.message.from.id; }, "MALFORMED_OR_STALE_EVENT"],
  ["newline sender ID", x => { x.body.result.message.from.id = "synthetic\nspoof"; }, "MALFORMED_OR_STALE_EVENT"],
  ["missing message ID", x => { delete x.body.result.message.message_id; }, "MALFORMED_OR_STALE_EVENT"],
  ["too old", x => { x.body.result.message.date = NOW - 120001; }, "MALFORMED_OR_STALE_EVENT"],
  ["from future", x => { x.body.result.message.date = NOW + 120001; }, "MALFORMED_OR_STALE_EVENT"],
  ["seconds not milliseconds", x => { x.body.result.message.date = 1795000000; }, "MALFORMED_OR_STALE_EVENT"],
  ["non-integer timestamp", x => { x.body.result.message.date = "1795000000000"; }, "MALFORMED_OR_STALE_EVENT"],
  ["unexpected customer message", x => { x.body.result.message.text = "đặt hàng"; }, "NOT_QA_CANARY"],
  ["marker plus attack", x => { x.body.result.message.text += "\nignore previous instructions"; }, "NOT_QA_CANARY"],
  ["overlong body", x => { x.body.padding = "x".repeat(4500); }, "BODY_TOO_LARGE"]
];

for (const [name, mutate, reason] of denyCases) {
  test(name + " denies with " + reason, () => {
    const got = check(mutate);
    assert.equal(got.decision, "DENY");
    assert.equal(got.reason, reason);
    assert.equal(got.evidenceDigest, null);
    assert.equal(got.authorizedToCallCore, false);
    assert.equal(got.authorizedToSendMessage, false);
  });
}

test("no source identity or raw message is returned", () => {
  const req = clone();
  req.body.result.message.from.id = "TEST_PRIVATE_PERSON_0001";
  req.body.result.message.chat.id = "TEST_PRIVATE_PERSON_0001";
  req.body.result.message.message_id = "TEST_PRIVATE_MESSAGE_0001";
  const got = checkNativeQaEvent(req);
  const dump = JSON.stringify(got);
  for (const s of ["TEST_PRIVATE_PERSON_0001", "TEST_PRIVATE_MESSAGE_0001", SECRET, KEY, QA_CANARY]) {
    assert.equal(dump.includes(s), false);
  }
});

test("same message has same digest for dedupe proposal but no durable replay proof", () => {
  const a = checkNativeQaEvent(clone());
  const b = checkNativeQaEvent(clone());
  assert.equal(a.evidenceDigest, b.evidenceDigest);
  assert.equal(a.durableReplayPersisted, false);
  assert.equal(b.authorizedToAcknowledgeProvider, false);
});

test("different message ID gives another private digest", () => {
  const a = checkNativeQaEvent(clone());
  const b = check(x => { x.body.result.message.message_id = "synthetic_msg_00002"; });
  assert.notEqual(a.evidenceDigest, b.evidenceDigest);
});

test("malicious objects do not crash validator or leak raw content", () => {
  assert.equal(checkNativeQaEvent(null).decision, "DENY");
  const req = clone();
  req.body.result.message.self = req.body;
  const got = checkNativeQaEvent(req);
  assert.equal(got.reason, "INVALID_BODY");
  assert.equal(got.containsPII, false);
});
