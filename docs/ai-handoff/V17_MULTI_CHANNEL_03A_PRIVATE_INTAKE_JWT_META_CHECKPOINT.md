# TIEN404 AI — V17.MULTI-CHANNEL-03A
## Private Merchant/Staff Evidence Intake × Same-Tenant JWT UAT Admission × Native Meta Handover Compatibility

**Date:** 2026-11-17 JST. **Verified real status: NO-GO for actual Store A/B JWT and Meta Handover UAT**.
**Parent PR:** [#304](https://github.com/ngoctien20/demo-git/pull/304) exact HEAD \`9aad8b74b72fd84e86dd4fc3698cb9d6bc150bad\`.
**Scope:** GitHub additive source-only, QA fixtures, connected Supabase/n8n *read-only* aggregate inspection; no credential, no customer data, no provisioned vault, no R2 write, no provider API call, no SQL/Store DDL, no Meta thread transfer.

### 1. Directly verified as of this checkpoint

- Supabase staging \`tien404-staging\` \`ifxlvrhyjhbzbrkdsida\`: public Commerce **0/6** Store ID columns and **0/6** Store-based RLS predicates. Existing 6 core tables have RLS enabled, but this is NOT Store isolation.
- \`public.stores\`, \`public.store_memberships\`: **ABSENT**; no canonical commercial Store member authority proven.
- Distinct active members with matching Auth session rows: **ZERO same-Tenant pairs**, despite existing aggregate session records. Database \`auth.sessions\` rows are not signed JWT readbacks.
- \`tien404_r1_qa.owner_bindings\` has **2 QA binding rows** and **ZERO Tenants with 2 distinct Store owners** in this QA table. These are \`synthetic_qa\` fixtures with \`tenant_key\`/\`store_key\`, not the canonical commerce Store ACL. No binding modified.
- n8n Messenger \`Z7FdV7uDvApfbURQ\` active version \`1064b1b3-d3f1-4a6b-a367-2414ba691522\`, Zalo Bot \`yIJk8LvJoLF40Z62\` active \`2d912cb0-007f-452f-9536-b92ba12a03e6\`, private router \`sIPs6egzIwOY1GNv\` active \`8d91d23c-cd87-462f-a112-9cca2340bec8\`. All inspected only.
- Existing [PR #243](https://github.com/ngoctien20/demo-git/pull/243) V17.1E raw-body HMAC handler is **text-only** and its pinned version at SHA \`652010d33a96b3daf3892fb660099c196cef2cf5\` was already tested by PR #304. Do not rewrite or replace it.
- Earlier actual signed Messenger DEMO shadow from PR #272 **also ran the legacy reply sender**; it was NOT a private signed handover no-send pilot.

### 2. Added source-only modules

**\`private-evidence-intake.mjs\`** validates only a short-lived opaque ticket with a type and stage. An approved human must store and review originals in a separately authorized encrypted private vault. It DOES NOT accept uploads, URLs, personal IDs, raw Page IDs, screenshots, JWTs, OAuth codes or tokens. It DOES NOT create or sign review decisions.

**\`dual-store-jwt-uat-rehearsal.mjs\`** models two independently authenticated browser slots (A and B) and real PostgREST RLS sentinel-readback interfaces, including token/session revocation. It explicitly disables any real Auth/DB execution and **never returns actualJwtVerified=true** even when synthetic fixtures pass. The future real private runner must:
1. Obtain actual owner consent and **two distinct logged-in users** in separate browser sessions; do not transmit JWT into chat, GitHub, n8n logs or test snapshots.
2. Use server-authenticated \`getUser(accessToken)\` and fresh session checks; do not derive roles from untrusted \`user_metadata\`, client scopes or a server \`service_role\` query.
3. Confirm **same Tenant**, **different canonical Store IDs**, separate owner/staff assignments from trusted storage. Currently impossible until Store ACL is approved and deployed.
4. Query two approved sentinel QA rows via **each user's own JWT**, separately: own Store row visible; other Store's seeded row inaccessible. An empty result without a known seeded sentinel is NOT sufficient proof of RLS.
5. Revoke a commercial Staff assignment and verify a **fresh JWT-scoped read** denied, not merely a locally cached state flag.
6. Private independent operator witnesses both sessions and records only non-sensitive digests/check summaries outside GitHub. No real customer records and no writes.

**\`meta-handover-fixture-classifier.mjs\`** recognizes strict one-entry, one-event, QA Page/Tester, App ownership transition *synthetic shapes* for \`pass_thread_control\` and \`take_thread_control\`. It does not HMAC verify, sign, replay claim, persist, transfer thread control, or unmute bot. All outputs prohibit real operations.

Use the already existing V17.1E HMAC module in [#243](https://github.com/ngoctien20/demo-git/pull/243), PR #269 trusted authority orchestration, PR #272 disposable PG17 replay lab, and PR #295 Handoff state machine. A separate native event adapter can only be considered after independently capturing an approved QA Page \`messaging_handovers\` event (no-send) and proving the exact schema; the synthetic shape is **not provider confirmation**. Meta \`pass_thread_control\`, \`take_thread_control\`, \`release_thread_control\` POST calls change conversation ownership, thus require a **separate named approval** even with zero text messages.

### 3. Existing private evidence process — exact operator handoff

Reuse [PR #196](https://github.com/ngoctien20/demo-git/pull/196) Native Meta Page/OA private proof SOP. **No new competing registry or cloud bucket**. The existing Cloudflare R2 account is not an authorization to upload real Merchant documents, and a GitHub PR is NOT private evidence storage.

**Merchant/Staff authority required privately:**
- Real business Controller/merchant and original document provenance; merchant consent to specific canonical Store and tenancy, purpose and expiry.
- Owner of two Stores with **same Tenant** versus synthetic/test bindings; independent reviewer and an approved recovery operator.
- Named staff roles and precise Inbox capability per Store, expiration and immediate revocation.
- Private account-bound proof tickets; encrypted custody, access audit, retention, incident handling, quarantine for malicious URLs and attachments. Never auto-fetch a merchant-supplied link; manual verification in isolated environment and malware scanning are required.
- Do not attach originals, ID numbers, emails, Page IDs, PSIDs, screenshots with sensitive content, passwords or JWTs in PR/chat.

**Meta Page authority privately:**
- Real Meta Business admin role and asset rights (NOT a public Page URL), app/Page binding, role of Primary/Secondary receiver, \`pages_messaging\` and required App review, Page subscription to \`messaging_handovers\`, restricted test recipient, independent approval.
- Dedicated QA App/Page separate from production, exact fixed callback, managed App secret/HMAC raw bytes with bounded payload and durable replay; event identity must tie to verified Page, tester and pending handover request.
- Existing Meta/DEMO callback continues uninterrupted. Do not change Page subscription, call Graph POST, or send messages. First approved UAT must be an independently scoped **passive signed NO-SEND observation**. A real thread transfer is a separate later mutation gate.

### 4. Real UAT release gates (hard NO-GO)

- Pre-M1 backup/recovery acceptance (independent real restore witness) and canonical Store/Staff ACL migration require their own approvals via PR #290/#247/#196. Not authorized here.
- Real dual same-Tenant JWT sessions and positive/negative Store-A/B and revoked Staff sentinel tests: NOT DONE.
- Real independent Meta Page/App admin entitlement and separate QA App/Page: NOT VERIFIED in this task.
- Native Meta signed \`messaging_handovers\` callback: NOT RECEIVED in this task.
- Hosted restricted QA Worker/secret/durable replay, provider send, webhook callback replacement, n8n publish, live thread-control changes: NOT AUTHORIZED.
- Sources: https://supabase.com/docs/reference/javascript/auth-getuser (getUser performs authenticated server check), https://developers.facebook.com/docs/graph-api/webhooks/getting-started/ (raw SHA256 Meta signature), https://developers.facebook.com/docs/messenger-platform/reference/webhook-events/messaging_handovers , https://developers.facebook.com/docs/graph-api/reference/page/pass_thread_control/ .
- Never interpret a test-success count as independent proof of private authority.

### 5. QA, risks and rollback

QA:
- \`node --test qa/v17-multichannel03a/*.test.mjs\`
- Inherited PR #304 (with pinned source #243), #298, #295 and Zalo OA suites.
- Exact HEAD GitHub Actions CI required before marking TESTED; positive synthetic tests never grant hosted admission.

Risks: **P0** nonexistent real Store owner/Staff ACL, provider Page authority, absent audited recovery, session/JWT and Store RLS. **P1** Meta native event schema varies by provider/product; no real callback; unsafe legacy responder concurrency; stale token/replay; malicious owner files/URLs.

Rollback: close the child Draft PR; zero hosted resources changed, no credential or customer artifacts created, parent PRs preserved.

**Next actual operation requiring separate approval:** independently verified original Merchant Store A/B proof + current backup/recovery and RLS migration authorization, followed by two real browser sessions. For Meta, independently approve dedicated QA App/Page native owner evidence, then isolated passive signed no-send event. No live handover transfer without a **second, explicit** thread ownership change approval.
