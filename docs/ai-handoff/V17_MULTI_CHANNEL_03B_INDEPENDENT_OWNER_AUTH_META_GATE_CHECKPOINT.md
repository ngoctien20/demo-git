# TIEN404 AI — V17.MULTI-CHANNEL-03B
## Independent Merchant Owner Proof × Same-Tenant Store A/B Real Auth Admission × Dedicated Meta QA Page No-Send Gate

**Date:** 2026-11-17 (JST). **Status:** VERIFIED hosted metadata; IMPLEMENTED source-only cryptographic review; Real Store/JWT and Meta QA Page acceptance **BLOCKED**.

**Parent:** [PR #308](https://github.com/ngoctien20/demo-git/pull/308) at pinned SHA \`ad7d28015e9764daf66a6a399214d5ddc2d51ee7\`. Source-only child: no merge, deploy, n8n publish, provider call, hosted DB write, token use, merchant file intake or paid model.

## 1. Directly verified live baseline (READ ONLY)

Supabase staging project \`ifxlvrhyjhbzbrkdsida\` remains ACTIVE_HEALTHY, PG17.11. Exact 2026-11-17 SQL metadata-only aggregate result (no user ID, customer row or token):
- Six Commerce tables audited: Products, Orders, Customers, Order Items, Conversations, Messages.
- **0/6** have canonical \`store_id\` and **0/6** Store-qualified RLS policies. Earlier read-only verification confirmed 6/6 have RLS enabled; *RLS enabled is not same-Tenant Store isolation*.
- \`public.stores\`, \`public.store_memberships\`, \`public.commercial_staff_assignments\`: **0**.
- 1 tenant with two+ distinct active tenant membership users; **0** tenants with two distinct active membership users and matching \`auth.sessions\` records satisfying the \`not_after\` filter; 5 Auth session rows satisfy that time filter globally. **Session metadata does NOT prove a verified browser JWT**.
- \`tien404_r1_qa.owner_bindings\`: two existing synthetic/QA bindings; **0** tenants with two active, different Store/Owner bindings in the QA table. These cannot be promoted into real Merchant authority.

n8n active versions, inspected metadata only:
- Messenger \`Z7FdV7uDvApfbURQ\` \`1064b1b3-d3f1-4a6b-a367-2414ba691522\` (32 nodes; includes legacy DEMO sender and order tools).
- Zalo Bot \`yIJk8LvJoLF40Z62\` \`2d912cb0-007f-452f-9536-b92ba12a03e6\` (12 nodes).
- Zalo private router \`sIPs6egzIwOY1GNv\` \`8d91d23c-cd87-462f-a112-9cca2340bec8\` (6 nodes).
- No executions, credentials, customers or workflows modified.

Existing source PR #243 latest HEAD may move; **pinned helper blob** \`qa/v171d-meta-authority/page-app-readonly.mjs\` SHA \`19fa8c31fdf0b959d51cad0c746e7c8ee8a44490\` was checked identical at recent latest head and the prior pinned source SHA \`652010d33a96b3daf3892fb660099c196cef2cf5\` in this task. CI checks out **that exact pinned SHA**, never the moving branch name.

## 2. Implemented: genuinely cryptographic review, still no ownership certification

**\`qa/v17-multichannel03b/independent-owner-proof-review.mjs\`**:
- Verifies **actual Ed25519 signatures** over a deterministic, strictly allowlisted **opaque metadata claim** from two distinct roles, Merchant Owner and Independent Reviewer.
- Operator-pinned, separate public keys in an offline read-only trust-store port; reject wrong role, wrong Tenant, revoked/expired key, tampered Store/nonce, duplicate actor or key, expired consent.
- Separately compare a *pair* of signatures for two different Store aliases, distinct owner actors, same Tenant, distinct ticket/nonce.
- All private keys in synthetic tests generated in runner memory; no real owner credential is generated, fetched, stored or committed.
- **Important:** Private trust anchors, original merchant records, reviewer independence and lawful authority are **not independently checked by this source**. Even valid mathematical signatures are not proof of document authenticity or Store ownership. Therefore \`realMerchantOwnerVerified=false\`, \`canAdmitRealUat=false\`, \`canDeploy=false\` always. No real doc/URL/blob accepted.

**\`qa/v17-multichannel03b/meta-private-page-nosend-admission.mjs\`**:
- Consumes **existing** PR #243 V17.1D \`verifyReadOnly\` Page/App subscription visibility result; new source **does not call Graph or copy the helper**.
- Requires distinct QA vs production App/Page aliases, inactive QA callback, unchanged production callback, single-responder isolation plan, legacy DEMO sender cannot run alongside UAT, independent Page/QA-tester scope review, no paid AI/Commerce, no Graph POST or outbound send.
- A positive read-only \`subscribed_apps\` GET is still labelled **Page visibility not Merchant owner proof**, and even full self-reported private-review flags never authorize callback/Graph/send. Existing historical signed Messenger shadow PR #272 involved an **actual legacy send** and cannot satisfy dedicated no-send pilot.
- The pinned helper is imported in tests using injected mock fetch; no real Meta Graph call, no live secret and no actual Page/App identity used.

## 3. Exact operator-only path for genuine real proof

**Reuse** rather than replace [PR #196](https://github.com/ngoctien20/demo-git/pull/196) native owner evidence SOP; [PR #290](https://github.com/ngoctien20/demo-git/pull/290) owner JWT/read-only gate, [PR #247](https://github.com/ngoctien20/demo-git/pull/247) six-surface Store design, [PR #243](https://github.com/ngoctien20/demo-git/pull/243)/[#269](https://github.com/ngoctien20/demo-git/pull/269) Meta signed no-send and owner guard, [#272](https://github.com/ngoctien20/demo-git/pull/272) disposable replay and historic shadow; existing staff/inbox from #298/#308.

**Merchant / Owner / Staff authority (private):**
1. Merchant owner submits ORIGINAL source/control evidence for exact Shop A and Shop B, original document provenance and lawful consent directly to the *separately pre-approved private encrypted vault*. No secret/PII in ChatGPT, PR, CI, R2 public URL or n8n logs.
2. Independent reviewer (not the claimant) verifies original ownership, tenant agreement, signed operator record and Store-specific staff permissions. Protect against malicious files/links: never blindly fetch URL; isolate parsing, malware scan, MIME/magic size cap and antivirus, SSRF allowlist if ever allowed. Set retention/deletion and access logging.
3. Reviewer/provider trust keys must already be pinned **outside the user-submitted claim** and controlled by Security/Operations. Verifying signatures with applicant-supplied keys would be self-authentication and gives **NO actual proof**.
4. Complete separately authorized PRE-M1 full recovery (Auth/roles/Storage coverage, independent restore) and actual Store table/RLS migration under code-owner approval. These steps **were not performed** and are not authorized by this source work.
5. Independent real Supabase Auth sessions A and B from two authorized owners for two distinct Stores in **the same Tenant**; \`auth.getUser\` with private access token, never user-editable \`user_metadata\` for Store role. Use each user's JWT (never service_role) and independent seeded QA sentinel IDs: own visible, cross-Store hidden, verified RLS policy, revoked commercial staff fresh-token test. No real customer data or write. Use only after the Store schema is actually enabled and backup approved.
6. Capture proof receipts in private immutable/expiring audit with a second independent reviewer; public GitHub contains only NO-GO/PASS code count and opaque ticket.

**Meta QA Page (private):**
1. Authorized Meta Business Admin + reviewer inspect genuine **dedicated QA Page and QA App distinct from production**, Page/App subscriptions, app Messenger permissions, Handover receiver roles, \`messaging_handovers\` status and a named tester in native Meta Business/Developers. Access to a Facebook home tab is not evidence of Page admin rights. No token or Page ID copied publicly.
2. Operator may run existing read-only PR #243 helper LOCALLY using private Page token after separate read scope approval; only sanitized flags are transferred. GET \`subscribed_apps\` visibility by itself is **not** proof of owner/business authorization.
3. A dedicated access-protected QA callback must remain INACTIVE while reviewing; require managed secret and durable replay, single responder and no simultaneous DEMO legacy sender. A private signed one-event **passive no-send** UAT requires scoped deployment approval. This branch does NOT deploy callback or initiate real webhook.
4. Meta \`pass_thread_control\`/\`take_thread_control\`/\`release_thread_control\` are **POST ownership mutations** even without text; require another separately scoped explicit Page/Tester/rollback approval, not contained here. The existing PR #243 HMAC helper accepts signed text, not native handover event schema, as independently proven by PR #304 CI. New synthetic classifier from #308 is NOT real provider compatibility acceptance.

## 4. QA and release / rollback

Run \`node --test qa/v17-multichannel03b/*.test.mjs\` plus inherited #308/#304/#298/#295 and Zalo OA sources. In CI, checkout pin \`652010d33a96b3daf3892fb660099c196cef2cf5\` in isolated folder. All source gates strictly \`canDeploy=false\`, \`canAdmitRealUat=false\`, \`canSendMessages=false\` regardless of mathematics or self-attested proofs. TESTED only after exact HEAD GitHub Actions success.

**REAL NO-GO:** no independently verified true merchant owner documents, no approved private vault, no production Store/Staff binding, no two real JWT owner sessions, no actual native Meta Page/App owner/Handover consent, no isolated hosted callback or native no-send handover, no storage/billing changes.

**Rollback:** close child Draft PR. Nothing modified on Supabase, n8n, Cloudflare, Meta, merchant customers or production. Keep ancestors and parallel ownership PRs intact.

Official references: https://supabase.com/docs/guides/auth/users ; https://supabase.com/docs/guides/database/postgres/row-level-security ; https://developers.facebook.com/docs/graph-api/reference/page/pass_thread_control/ ; https://developers.facebook.com/docs/graph-api/reference/page/release_thread_control/ .

---

## 5. RPC16 HOSTED INACTIVE CROSS-TRACK VERIFICATION — 2026-11-17 JST

This is **new independent read-only Cloudflare connector evidence**, cross-checking the currently open [RPC16 PR #313](https://github.com/ngoctien20/demo-git/pull/313) at exact HEAD `59b455badc5890f87d1b379415ad39e54e29f22e` and its SUCCESS run [44066765977](https://github.com/ngoctien20/demo-git/actions/runs/44066765977). No new Worker, Access app, bucket, token, invoice or storage object has been created in V17.03B.

| Existing Cloudflare resource | Verified current reading | Release interpretation |
| --- | --- | --- |
| R2 `tien404-merchant-evidence-quarantine-staging` | APAC / Standard; **0 objects** in current list | Private quarantine exists, no Merchant proof received |
| R2 `r2.dev` | **DISABLED** | Do not enable public development URLs |
| R2 custom domains | **ZERO** | No direct R2 public hostname |
| Access `TIEN404 RPC16 Merchant Evidence Staging — DENY ALL` | App exists, **0 app policies** (no Allow/Bypass), hidden launcher, 15m session | Not an authenticated Merchant admission portal |
| Worker `tien404-rpc16-merchant-evidence-inactive-staging` | Script exists; has **one** `R2_QUARANTINE` binding, disabled `workers.dev` subdomain | R2 binding is **not** an enabled upload path |
| Worker code | Current Cloudflare script includes `INACTIVE_DENY_ALL_NO_SEND`, 404 response; no direct R2 PUT observed | Intentionally inactive; no real upload or scanner |
| Account Worker Domains | **1 domain, none bound to RPC16 Worker** | No account-level custom Worker Domain |
| Account zone routes | 1 visible Zone `ngoctien20.io.vn`, **0 Worker routes** | No Worker route on accessible Zone; no external browser canary attempted |

**Do not infer too much:** No actual end-to-end external anonymous browser probe was performed because no public route is desired. No independent Cloudflare API token inventory was available. Access with zero policies is a **DENY ALL checkpoint**, NOT authentication plus admission. Public access must remain disabled. R2 object count was read through connector GET; no object key or byte was fetched.

**Already built; DO NOT rebuild:** [RPC13 #285](https://github.com/ngoctien20/demo-git/pull/285) has the existing operator-only `qa/v152-rpc13/live-auth-uat.mjs` with an actual two-JWT remote Supabase `getUser` and six-surface PostgREST sentinel test. This is real network-capable source code, but **has not been executed with actual Store A/B identities** and cannot pass current canonical Store/RLS prerequisites. The runner must not be invoked with real tokens or configured with merchant materials before isolated operator approval. On Windows, the script currently skips POSIX mode bits; operators must separately verify restrictive **NTFS ACL**, local secret-file storage and secure deletion; no token may be pasted into ChatGPT/GitHub/CI.

**Cross-team release sequence / exact handoff, not authorization:**

1. **Merchant Owner / Security Reviewer:** independently identify and prove original Merchant/Owner of four legacy Products/Orders records (P1/P2/O1/O2) using primary sources, no files/URLs in chat/GitHub. Confirm lawful purpose, distinct same-Tenant Store A/B records, reviewer separation, correct consent and revocation. The encrypted private intake portal remains inactive; no upload invitation may be issued yet.
2. **Privacy/Cloudflare Team:** keep RPC16 404/DENY ALL; approve separately the missing hosted scan/CDR, invitation/replay, quotas, retention, managed secrets, independent Access identity and restore before **any real intake**. A billing alert is not a spending cap.
3. **DB/Recovery Team:** use existing [#290](https://github.com/ngoctien20/demo-git/pull/290), [#247](https://github.com/ngoctien20/demo-git/pull/247) and PRE-M1 recovery track; obtain complete independent restore evidence and separately approved Store/Staff schema + RLS before changing hosted database. Current real tenant-only RLS cannot isolate two Stores in the same Tenant.
4. **Auth UAT Operator:** ONLY after (1)-(3), privately run pinned RPC13 operator tool with **two real independently logged-in users**, same Tenant, different Store, six approved QA sentinel pairs; verify positive own Store and negative cross-Store reads, staff revocation with fresh Auth. Log only anonymous counts and reviewer sign-off.
5. **Meta Page Owner / Independent Reviewer:** reuse [#196](https://github.com/ngoctien20/demo-git/pull/196) and existing Meta [#243](https://github.com/ngoctien20/demo-git/pull/243)/[#269](https://github.com/ngoctien20/demo-git/pull/269) evidence. Verify separate QA App/Page and real Handover roles privately, then seek a **separate scoped** passive signed one-shot no-send callback authorization. **No Meta thread-control POST** under this source-only checkpoint.

**Checkpoint result:** `RPC16_PRIVATE_BUCKET_VERIFIED · ACCESS_DENY_ALL · WORKER_404_INACTIVE · NO_PUBLIC_ROUTE_OBSERVED · REAL_MERCHANT_0_VERIFIED · SAME_TENANT_JWT_UAT_NO_GO · META_HANDOVER_NO_GO`.

**Rollback:** V17.03B has no hosted change to roll back; close its Draft PR for source-only rollback. Do **not** delete, redeploy or change RPC16 Cloudflare resources as part of this track; those belong to separate PR #313 and require explicit owner/security approval.
