# TIEN404 G0.9 — Authorized Provider Binding × Isolated Real Signed No-Send Pilot

**Date:** 2026-11-17 JST  
**Lifecycle:** SOURCE CANDIDATE / DRAFT / NO REAL PROVIDER EVENT ACCEPTED  
**Parent:** G0.8 Draft PR #265 at commit \`7c5086751fd5551a3626e1621f18790141ca3dab\`  
**Child:** [G0.9 Draft PR #269](https://github.com/ngoctien20/demo-git/pull/269)  
**Deployment decision:** **REAL SIGNED NO-SEND PILOT BLOCKED** until separate private first-party Page/App authority and Store ownership are verified. **NO live endpoint/callback change**.

## 1. Audit before changes — actual n8n/Meta evidence

1. Published Messenger DEMO workflow \`Z7FdV7uDvApfbURQ\` retains version \`d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92\`; selected real webhook execution \`4176\` on 2026-11-16 confirmed two independent node flags \`verified=true\` and **actual Send Messenger Reply** node executed SUCCESS. That route serves legacy DEMO and is not a safe No-Send Commerce channel.
2. Zalo Bot ingress \`yIJk8LvJoLF40Z62\` remains Published ACK/No-Send, but its 11 latest observed executions are **manual**; real Zalo OA provider native signature remains unverified.
3. Central Commerce Core \`iyfGUiEsZlNTBWOR\` Inactive; manual QA workflow \`7XzLd51D7C6tlaS4\` exec \`4381\`: real Core **8/8 unbound channel calls denied**, zero send/write/model, but no authenticated Store-level RLS.
4. G0.7 private authority Inactive workflow \`mmt3ToandWrLAcjH\` exec \`4401\`: 20/20 synthetic attempts to claim real inbound authority correctly denied. Registry G0.5 has only synthetic \`QA_SYNTHETIC_NO_REAL_OWNER\` bindings.
5. Existing V17.1E [Draft PR #243](https://github.com/ngoctien20/demo-git/pull/243) owns Meta isolated No-Send callback source \`qa/v171e-meta-real-event/isolated-meta-no-send.mjs\`; latest audited exact source at **\`d5fbd6958635069d15343be573cdbd4b55cc036c\`**. Its real boundary requires a distinct QA App/Page/tester, private App Secret, raw POST HMAC, explicit operator approval and injected atomic \`claimOnce\`. It has *no listener* or real provider Page evidence.
6. Current connected browser does **not** expose authenticated Meta Developer/Business Manager or Zalo OA admin tabs in this iteration. No current independently verifiable separate QA Meta App/Page or actual OA owner rights were supplied. **DO NOT** infer production Page control or duplicate/transfer existing subscriptions.
7. Official Meta docs https://developers.facebook.com/docs/graph-api/webhooks/getting-started/ explain TLS endpoint, \`hub.verify_token\` challenge, \`X-Hub-Signature-256\` over raw POST bytes and Meta retries. One approved dedicated isolated callback and deduplication are essential. Meta GET challenge alone isn't POST origin or merchant ownership. Zalo OA native authentication remains a separate provider-specific unknown and is not enabled.

## 2. Implemented new additive G0.9 code — does not duplicate native verifier

- \`qa/v152-g09/isolated-meta-private-admission.cjs\` is a **small orchestration adapter**, NOT a second HMAC implementation. It accepts the **pinned existing V17.1E exported handler** by dependency injection.
- It requires a separately controlled **private operator authority loader** and **private Meta QA configuration loader**: distinct Owner/Reviewer, original provider evidence commitment, genuine QA Page/App owner/subscription proof, explicit test-sender permission, callback isolation and preservation, canonical Merchant Store binding, short-lived reviewer receipt and an **atomic durable claim** callback.
- An incoming POST can supply **only** raw bytes, URL and headers. It cannot set Store, Tenant, Owner, reviewer, source proof, Page/credential policies or JWT authority. The Meta handler rechecks exact App/Page/tester, HMAC, freshness and MID.
- Source candidate returns a sanitized HMAC receipt for a fixture that passes the **pinned V17.1E handler**, with status \`G09_PINNED_META_HMAC_QA_NO_SEND_PASSED\`, but clearly sets \`realProviderEventIndependentlyCertifiedHere=false\`, \`realSignedPilotCompletedHere=false\`, \`realCommerceStoreOwnershipCertifiedHere=false\`, \`durableIdempotencyProvenHere=false\`. This is intentional: a fake test policy with mocked proof flags cannot demonstrate live Page ownership. The fixture's in-memory claim hook only models the required atomic persistent interface.
- Every result, even fixture-positive, has \`canPublish=false\`, \`canModifyProviderCallback=false\`, \`canUseProductionCredentials=false\`, \`canReadCustomerOrders=false\`, \`canSendMessages=false\`, \`canCreateOrders=false\`, \`canPromoteRls=false\`, \`providerSends=0\`, \`modelCalls=0\`, \`hostedCommerceReads=0\`, \`hostedWrites=0\`.
- \`qa/v152-g09/isolated-meta-private-admission.test.cjs\` tests the **real referenced source code from independent V17.1E** instead of copying it into the G0.9 branch. CI uses second read-only checkout at pinned exact V17.1E SHA into \`.g09_v171\`. Tests contain **invented** Page IDs, tester PSID and QA-only App Secret, never credentials or personal messages.
- \`.github/workflows/v152-g09-authorized-provider-isolated-nosend.yml\`: Node22 pinned V17.1E original tests + G0.9 cross-branch integration/deny tests + inherited G0.4–G0.8 regressions + explicit live NO-GO job. CI run and exact-HEAD result must be verified before declaring Github source TESTED.

## 3. Private Operator and Reviewer one-event admission — authorized checklist

All identities and source documents remain in **private control plane**. No Page ID, app secret, OA token, customer PSID, real message, QR, ownership screenshot or credential pasted into GitHub PR, chat or CI.

1. **Provider scope and consent:** Choose a **distinct QA Meta App + distinct QA Page**, or request separate explicit approval for a reversible, isolated shadow configuration. Designate named human Operator and independent Reviewer. The existing live Messenger DEMO callback **must not be changed**. Confirm one specifically permitted text-only test sender.
2. **First-party owner inspection:** Privately verify App admin and Page full-control rights, binding/subscription and callback scope in live Meta settings or a documented authorized read-only Graph request. A declaration or uploaded screenshot without current independent verification is **not** accepted as source authority.
3. **Canonical Store ownership:** Verify original Shop/merchant controls, actual Store UUID, Tenant UUID, Store Membership and exact Page installation; do not derive Store from Tenant nor automatically backfill the 2 Product + 2 Order source records.
4. **Isolated HTTPS receiver:** Obtain separate test endpoint with TLS, preserve original webhook bytes, private App Secret in secret manager, registered GET verify token. Before enabling endpoint, inspect its no-send HTTP routing; do not connect to production Page callback or send any messages. Establish emergency disable/revocation and owner signoff.
5. **Durable replay:** Implement a shared atomic single-event claim scoped to installation+provider MID, expiring appropriately; in-memory single-worker Set is insufficient in a real receiver. Prove duplicate and replay do not invoke a second task. Never store payload or tokens in logs.
6. **One real test, no commerce:** After approval, have the designated QA sender send exactly **one test text** to QA Page. Collect only confidential hashed reference, provider signature verified (actual raw bytes), accepted callback timestamp, reviewer receipt and **0 sends/0 model/0 Orders/0 Stock/0 hosted customer reads**. If error, disable QA receiver, do not retry with prod Page.
7. **Independent review and release:** Reviewer checks underlying private source, receipt and isolation, then separately authorizes downstream **read-only** synthetic Store catalog. Do **not** automatically unlock real Commerce, Messenger Sends, Zalo OA, Subscription, hosted RLS, orders or production cutover.

**Alternative:** If a separate QA Meta App/Page cannot be provisioned or verified without cost/permission, **stop at source-tested candidate**. Do not reuse legacy DEMO production callback to manufacture a No-Send acceptance.

## 4. Limits and no-go boundaries

- Real Meta POST to new isolated QA callback **NOT OBSERVED**; no real signed No-Send receipt.
- No actual independent Page/App Owner, Reviewer and Merchant Store authority proven in G0.9. Code checks the shape of **injected private claims** but source-only does not authenticate those claims.
- No Zalo OA native signature nor cross-channel customer identity challenge.
- Current hosted Store JWT/RLS and original Store four-row evidence remain BLOCKED. Actual local-machine backup is **DEFERRED BY OWNER**, not proof of current independently accepted hosted recovery; no hosted DDL/RLS is authorized.
- No n8n Published edit/new webhook/credential change, no production callback change, no real customer read, no provider send, no order write, no paid environment created. No new n8n Inactive workflow was necessary: pre-existing V17.1E and V17.12 inactive QA surfaces are retained for the authorized callback, avoiding duplicates.
- Source-only rollback: close Draft PR #269; no actual external side effects to revert.

**Checkpoint:** \`G09_PINNED_V171E_META_HMAC_PRIVATE_ADAPTER__REAL_SIGNED_CALLBACK_NOT_OBSERVED__HOSTED_NO_GO\`.
