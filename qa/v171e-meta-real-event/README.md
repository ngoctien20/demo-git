# TIEN404 V17.1-E — First Real Meta Signed No-Send Event (Operator Gate)

Date: 2026-11-17 JST. SOURCE QA ONLY. No live Meta QA App/Page has been created in this task. No signed real event delivered to a new shadow callback. All deployment/send/write gates remain NO-GO.

## Preserve verified historical context
- User previously confirmed Fanpage Full Control and showed Meta Developer App Administrator and existing webhook settings. Those are historical operator/screenshot attestations; no need to request them again, but they are not evidence of a SECOND dedicated QA App and QA Page.
- Existing Published Messenger Z7FdV7uDvApfbURQ had successful real signed webhook execution #4176. Do not change its App callback, Page subscription, credential, tool or send node.
- V17.1-D n8n locked shadow 6ZWYRBKieTKQMzoQ remains inactive and configured to respond 403. It has no Meta GET challenge and is not a ready production callback.
- V17.1-C QA registry cnSZ6hT7WCbNwGl5 is synthetic only. Never use its rows for real Page authority.

## Private owner evidence requirements — no token or private IDs in PR/chat
1. NEW QA Meta App distinct from the current live Messenger App; independently confirmed App Admin/Developer authority and separate callback.
2. NEW QA Facebook Page distinct from the production Page, with independently verified merchant/operator Page control and messaging permissions.
3. Existing read-only Graph helper from V17.1-D can check Page/App visibility locally, without credentials exposed. A successful subscribed_apps GET is not standalone Business Manager ownership evidence.
4. Written scope approval for exactly ONE QA tester's inbound message and a separately configured QA callback. No live outbound, no production callback modification, no Commerce data or billable model.
5. Confirm the QA app/page IDs differ from corresponding production IDs, private App Secret and verify token stored only in secret manager, not GitHub or execution logs.
6. Durable atomic idempotency claim mechanism and privacy-safe receipt. Test-only memory Set is not proof for a multi-worker environment.
7. Private operator rollback owner and before/after QA App subscription snapshot. Live Published Messenger must remain untouched.

## Executable source QA contract
- Module: isolated-meta-no-send.mjs. It exports handleIsolatedMeta; NO network listener and NO live callback deployment.
- GET: validate hub.mode, hub.verify_token timing-safe, bounded numeric hub.challenge.
- POST: verify HMAC-SHA256 over the exact raw Buffer, check QA Page/recipient and allowed tester, restrict to one text event, timestamp window, reject client-claimed Tenant/Store/Bot, use injected atomic claimOnce.
- Acceptance output contains only hashed receipt and no raw PSID, message text, secrets, Page/App ID.
- All results carry zero Meta send, zero paid LLM calls and zero Commerce writes. A validated duplicate is HTTP 200 without reprocessing.
- Source config requires PRIVATE owner attestation, different QA vs production App/Page, and atomic claim injection. It does not independently certify actual Business Manager ownership.

Run offline (Node 22+):
  node --test qa/v171e-meta-real-event/isolated-meta-no-send.test.mjs

## Required real pilot gates (NOT RUN)
- [ ] Private QA App/Page authority and distinctness verified independently.
- [ ] Dedicated HTTPS callback GET/POST deployed after explicit operator approval, with real secrets only in private runtime.
- [ ] Trusted Page→Store→Custom Bot binding tied to real owner proof; Store/JWT-RLS before any Commerce read.
- [ ] Durable atomic claim, designated QA tester, precise one-event test permission.
- [ ] A genuine Meta POST signature verified against dedicated QA App Secret; capture only safe execution metadata.
- [ ] 0 Meta outbound, 0 Commerce writes, 0 paid model calls; replay denied.
- [ ] Rollback/restore evidence and preexisting Published callback unchanged.

Release: SOURCE QA GO when CI passes; FIRST REAL SIGNED META INBOUND TO NEW SHADOW remains BLOCKED until above evidence and scoped authorization. Do not automatically enable V17.1-D shell or copy synthetic registry into production.
