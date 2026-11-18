import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { assessCrossChannelEvidence, REQUIRED_SIGNALS } from "./e2e-evidence-gate.mjs";

const snapshot = JSON.parse(readFileSync(
  new URL("./verified-readonly-snapshot.json", import.meta.url), "utf8"
));
const ALL = Object.fromEntries(REQUIRED_SIGNALS.map(key => [key, true]));

test("observed runtime snapshot remains NO-GO without Zalo, Store and order E2E", () => {
  const actual = assessCrossChannelEvidence(snapshot);
  assert.equal(actual.status, "HOSTED_E2E_NO_GO");
  assert.equal(actual.evidenceSatisfied, 1);
  assert.equal(actual.evidenceRequired, 14);
  assert.ok(actual.missing.includes("zaloNativeWebhookObserved"));
  assert.ok(actual.missing.includes("commerceStagingOrderPersisted"));
  assert.ok(actual.missing.includes("independentCustomerBDenialObserved"));
});

test("all claimed booleans are ONLY a review checklist, NEVER auth or release", () => {
  const a = assessCrossChannelEvidence({ signals: ALL });
  assert.equal(a.status, "CHECKLIST_COMPLETE_INDEPENDENT_REVIEW_REQUIRED");
  assert.equal(a.missing.length, 0);
  for (const name of [
    "realProviderIdentityEstablishedByThisCode",
    "signedOwnerSessionVerifiedByThisCode",
    "merchantCustomerDataReadAuthorized",
    "orderWriteAuthorized",
    "outboundMessageAuthorized",
    "hostedReleaseAuthorized",
    "productionReleaseAuthorized"
  ]) assert.equal(a[name], false);
  assert.equal(a.sourceMetadataCannotAuthorize, true);
});

for (const key of REQUIRED_SIGNALS) {
  test("missing critical " + key + " fails closed", () => {
    const a = assessCrossChannelEvidence({
      signals: { ...ALL, [key]: false }
    });
    assert.equal(a.status, "HOSTED_E2E_NO_GO");
    assert.deepEqual(a.missing, [key]);
    assert.equal(a.outboundMessageAuthorized, false);
  });
}

test("truthy strings, numbers and objects do not establish live proof", () => {
  for (const fake of ["true", "PASS", 1, {}, [], null]) {
    const report = assessCrossChannelEvidence({
      signals: { ...ALL, zaloNativeWebhookObserved: fake }
    });
    assert.equal(report.status, "HOSTED_E2E_NO_GO");
  }
});

test("missing, primitive and array inputs deny without exception", () => {
  for (const input of [undefined, null, false, "PASS", 2, [], {}, {signals: []}]) {
    const report = assessCrossChannelEvidence(input);
    assert.equal(report.status, "HOSTED_E2E_NO_GO");
    assert.equal(report.evidenceSatisfied, 0);
  }
});

test("does not echo forged proof, phone, token, or merchant IDs", () => {
  const poison = "PRIVATE_SUPER_SECRET_ABC_XYZ";
  const report = assessCrossChannelEvidence({
    signals: { ...ALL, extraData: poison },
    jwt: poison,
    providerSender: poison,
    phone: poison,
    customer_id: poison
  });
  assert.ok(!JSON.stringify(report).includes(poison));
  assert.equal(report.productionReleaseAuthorized, false);
});

test("results are immutable and stable for an identical input", () => {
  const x = assessCrossChannelEvidence(snapshot);
  const y = assessCrossChannelEvidence(snapshot);
  assert.deepEqual(x, y);
  assert.equal(Object.isFrozen(x), true);
  assert.equal(Object.isFrozen(x.missing), true);
});

test("owner A/B login proof is different from customer A/B negative isolation", () => {
  const report = assessCrossChannelEvidence({
    signals: {
      ...ALL,
      independentCustomerBDenialObserved: false
    }
  });
  assert.equal(report.status, "HOSTED_E2E_NO_GO");
  assert.ok(report.missing.includes("independentCustomerBDenialObserved"));
  assert.ok(!report.missing.includes("privateOwnerABSessionsVerified"));
});
