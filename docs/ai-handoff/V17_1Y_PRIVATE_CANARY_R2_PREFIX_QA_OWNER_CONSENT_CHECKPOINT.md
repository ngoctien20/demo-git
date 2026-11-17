# TIEN404 AI — V17.1Y Protected Access Canary Authorization × R2 QA Prefix Inventory × Real Store A/B Identity Consent

Date: 2026-11-17 JST
Parent: V17.1X Draft PR #359, HEAD `5ed9742858d3028095101b69b2aeb18630e3d6da`.
Current stage: **READ-ONLY OBSERVATIONS VERIFIED / SOURCE CONSENT DESIGN IMPLEMENTED / REAL HUMAN CONSENT & HOSTED UAT BLOCKED / NO-GO**.

## A. What was ACTUALLY verified (read-only)

1. **R2 prefixed inventory — new direct evidence**: GET Cloudflare R2 List Objects for bucket `tien404-merchant-evidence-quarantine-staging`, using **exact** `prefix=qa-v171x-disposable/` and `per_page=1000`, returned a SUCCESS response with an array of **ZERO** objects and **NO** continuation indicator. No object key names were revealed; no object bytes were fetched. This establishes **prefix empty at that query moment** only. It does **NOT** authorize R2 deletion or guarantee prefix emptiness at a later time. Before any lifecycle PUT, re-list through a protected authorized collector, check pagination, and fence writes/ensure no concurrent upload under the prefix. Merely checking zero once is not sufficient to prevent TOCTOU with a later write.
2. Existing inactive Worker `tien404-rpc16-merchant-evidence-inactive-staging` with workers.dev and preview URLs disabled, zero matching custom domain, existing R2_QUARANTINE binding. R2 managed public URL disabled and zero custom domains. Access app `TIEN404 RPC16 Merchant Evidence Staging — DENY ALL` exists, returns **zero** policies from the account app endpoint. **No external positive or negative protected endpoint test has been performed**, and no live authenticated operator session is present in this milestone. Do not infer MFA status or network denial just from an app name.
3. Actual bucket lifecycle is a single enabled **Default Multipart Abort Rule**, with maxAge=604800 seconds (7 days), not a completed-object TTL. Zero R2 object-lock rules. Three Durable Object namespaces related to other QA experiments do not establish a durable replay binding on this Worker. No independently verified real scanner/CDR.
4. Supabase staging `ifxlvrhyjhbzbrkdsida` remains 2 mapped Stores in **different Tenants**, 2 owner bindings, **0** same-Tenant two Store/owner pairs, **0** qualifying same-Tenant two distinct active Auth member sessions, **0** direct Store-scoped policies for core legacy Products/Orders/Customers. No JWT/user emails or customer records read. `public.qa_shop_b_zalo_claim` remains a separate **anon executable SECURITY DEFINER** review candidate; do not invoke or alter without scoped approval.
5. Messenger Published `Z7FdV7uDvApfbURQ` (version `1064b1b3-d3f1-4a6b-a367-2414ba691522`) preserved all four original V17.15 nodes. Zalo Published `yIJk8LvJoLF40Z62` (version `2d912cb0-007f-452f-9536-b92ba12a03e6`) unchanged. V17.1P QA `p5OsIaB0NkMDFMw7` remains inactive, five nodes, no credentials.

## B. Explicit future permission packet — NOT approved by this code/chat

**Packet P1 — Existing Worker protected canary authorization:**
- Existing named Worker only; no new public route or bypass. A fully Access-protected **existing private QA endpoint** must first be explicitly identified by an authorized operator. Currently no reachable QA route has been proven, so P1 is **BLOCKED**.
- Authorized methods **GET and HEAD only**, request budget **4**, read-only/no-send/no-order/no-billing. Private operator/MFA challenge and independent security reviewer required before live probe. Verify **anonymous denied**, **authorized operator allowed**, and **Bypass absent** from actual policy and target path, with no new public hostname opened. A private identity challenge must not be satisfied by `approved:true` from chat. No external probe has been executed by V17.1Y.
- If the route does not exist, request **a separate deployment/routing approval** with a preflight rollback and Access tests BEFORE enabling it. This milestone does not allow route creation.

**Packet P2 — R2 24-hour disposable-prefix lifecycle change:**
- `qa-v171x-disposable/` had zero objects at a direct API audit moment. P2 is **PROPOSED, NOT APPROVED**. Re-run authenticated prefix inventory immediately before any separately authorized change, capture pagination/zero proof, and prevent uploads between inventory and policy application (e.g. isolating writes under a fresh unique prefix that has never been used, with an exclusive deployment gate). Also confirm backup of the exact existing lifecycle and object-lock/legal hold review.
- Propose retaining the original 7-day multipart-abort rule, plus a **DISABLED by default** 24h object expiration rule restricted to QA-only prefix. A Cloudflare R2 lifecycle PUT replaces the rule set; preserve every existing rule and do not apply a blanket prefix. Confirm signed owner deletion consent, cost limit, rollback, and independent validation before enabling. Restoring lifecycle cannot undo deleted objects.

**Packet P3 — Disposable QA Tenant / two Auth persona consent:**
- The project is solo-founder-operated. For technical Store A/B isolation, the founder may consent to creation of **two separate disposable QA Auth accounts** and Store bindings in **ONE newly created QA Tenant**, provided that scoped authorization, backup, rollback and independent permission review occur in the private admin channel. A single person controlling both accounts is **NOT** evidence of two independently consented real Merchant owners.
- P3 must not reassign any existing merchant, merge current Stores across Tenants, copy DEMO/live Products/Orders/credential, or create customer messages. Actual OAuth/JWT acquisition, password/MFA, session identities and RLS migration require new separate approval, zero PII in GitHub/ChatGPT or logs, and independently reviewed migration.
- After provision (ONLY if later authorized), verify two *different* real Auth user subjects/session IDs on the same new QA Tenant with Store A/B owner bindings. Test A→A allowed, A→B denied, B→B allowed, B→A denied, anon denied and revoked-session denied against disposable synthetic rows with actual Store-scoped RLS. `SET ROLE authenticated` and `service_role` are not substitutes for genuine JWT-based QA.

## C. Source-only cryptographic consent review

New file: `qa/v171y-private-consent/private-canary-consent-gate.cjs`.

- Takes only opaque private inventory/consent record references plus a bounded nonce. The private registry callback is required; no user-provided URL, file body, JWT or credential is accepted.
- Strict scope: existing Worker, exact staging R2 bucket and `qa-v171x-disposable/`, no new public route, 4 GET/HEAD max, no extra spend, no R2/Auth/membership/provider/customer writes. Source validates real prefix inventory shape, full pagination and empty count, short audit freshness, and prevents false-positive zero inventory when results are truncated.
- Two **independent, privately enrolled cryptographic signers** — infrastructure account owner and independent security reviewer — must sign the same commit/project/inventory/consent scope and one-time nonce using Ed25519 keys looked up exclusively in a trusted backend. The system cannot treat single-founder chat permission as a second independent reviewer, and never accepts client-supplied `approved=true`.
- One-time nonce consumed before any asynchronous lookup, and an injected durable atomic backend must prevent cross-instance replay. Re-check registry, key, inventory and consent state just before issuing a planning receipt.
- Synthetic tests use generated ephemeral private QA keys and pretend privately enrolled signers. They do NOT prove these real human consents or an external protected route exist.
- **Success is only** `PRIVATE_PROTECTED_CANARY_AND_QA_AUTH_CONSENT_REVIEW_ONLY`, with `allowProtectedCanaryExecution=false`, `allowPublicRouteCreation=false`, `allowR2Mutation=false`, `allowAuthProvisioning=false`, `allowRlsMutation=false`, `allowBilling=false` and `release=HOSTED_NO_GO`. Live tokens, real Store identities, actual signed callbacks, R2 object bodies, malware scanner or Cloudflare writes are never handled.

## D. Test plan and release blockers

New fake-key source tests cover exact-prefix proof, pagination, stale prefix count, malicious URL/metadata injections, fake Auth ownership, request caps, independent cryptographic reviewer enrollments, revoked keys, atomic nonce reuse and TOCTOU. Inherit V17.1X 53 + V17.1W 44 + V17.1V 58 + V17.1U 25 + V17.1T 150 + 855 other tests = **1,185** inherited; new **40** planned, candidate **1,225** total, subject to actual independent GitHub CI verification. PG17 fixture is synthetic and rolled back, not hosted real Store RLS.

**Hosted release must remain NO-GO:** Actual protected Access GET/HEAD canary not permitted or performed; no private owner/reviewer signature stored, no new R2 lifecycle applied, no scanner/CDR/replay or two real same-Tenant Store Auth sessions. The deliberately red CI hosted job is not evidence of source regression.

## E. Change impact / rollback

Only a NEW child Draft GitHub PR with source, tests, read-only inventory evidence summary, CI, and runbook. No live Cloudflare PUT/POST/PATCH/DELETE, no n8n/Meta/Zalo send, no Supabase Auth/user/Store/RLS/schema change, no credential rotation, no real file download/upload/delete, no billing. **Rollback:** close child Draft PR. No operational restoration necessary.

Future real changes must each have a separate scoped permission, lifecycle/tenant backup and rollback checkpoint; do not automatically treat a new milestone name as authorization for irreversible work.

References: https://developers.cloudflare.com/r2/buckets/object-lifecycles/ , https://developers.cloudflare.com/workers/configuration/cloudflare-access/ , https://supabase.com/docs/guides/auth/sessions


## F. Independent CI evidence — VERIFIED 2026-11-17 JST

**Initial tested HEAD:** `b27f52124aab78f7700d9e00c595dbd5373de524`  
**GitHub Actions run:** https://github.com/ngoctien20/demo-git/actions/runs/44098186929

- **Job 134090826206 SUCCESS:** **40/40** new V17.1Y synthetic private signer/R2-empty-prefix consent tests + **1,185/1,185** inherited QA security/Commerce source regression cases = **1,225/1,225 PASS**. Live API inventory and source-only fake-key tests must never be confused.
- **Job 134090825739 SUCCESS:** independent disposable PostgreSQL 17 two Store RLS mechanical test with ROLLBACK. Not a real Supabase Auth JWT or real Store-scoped Commerce acceptance.
- **Job 134091189794 FAILURE BY DESIGN:** no private external protected Access canary/verified independent enrolled human consent, no authorized R2 lifecycle changes, no two real same-Tenant Store Auth JWT sessions or hosted reader isolation. Overall workflow red intentionally as `HOSTED_NO_GO`, not a source failure.
- **Actual read-only R2 prefix evidence:** successful List Objects call for `qa-v171x-disposable/`, 0 objects and no continuation. This is a point-in-time check without object/body/PII access; **rerun immediately and fence concurrent writes before any future policy changes**. The source suite is run with fake in-memory records; no real protected collector is connected.
- No real founder MFA signature or independent human reviewer consent has been enrolled, accessed or verified; both remain FALSE in the acceptance manifest. **This project is currently solo-operated**, so technical two-account QA cannot be represented as independent two-merchant-human acceptance.
- Published n8n and Cloudflare/Supabase production resources remain unchanged; only GitHub Draft child PR source/test/CI/docs are written. No real customer messages, Auth user creation, credential upload, R2 policy PUT, external Access probes or billable deployment.
- This checkpoint-only documentation change creates another Git SHA; run **exact final-HEAD CI again** before final sign-off.

**Disposition: VERIFIED READ-ONLY R2 PREFIX EMPTY AT CHECK TIME / SOURCE IMPLEMENTED & TESTED / INDEPENDENT OWNER CONSENT NOT VERIFIED / REAL HOSTED ACCESS & STORE JWT BLOCKED / PRODUCTION NO-GO.**
