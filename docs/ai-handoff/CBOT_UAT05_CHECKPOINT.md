# TIEN404 CBOT-UAT-05 — Real Recovery Evidence Intake × Native Channel Authority × Hosted Store Read-Only Authorization
**Checkpoint 2026-11-16 JST | EXPERIMENTAL/CANDIDATE | SOURCE-ONLY NO HOSTED WRITE**
Parent: CBOT-UAT04 Draft PR #213 pinned HEAD a383028c5a0b3355b94207aabe67ac80a172de69.
Security dependencies (not merged): H11R.11 PR #205, RPC.7 PR #198 (updated head 4f7bef71f54ee17b88449026b90803ccf9743e30), H11R.10 PR #200, V16.10 #212, Messenger PR #211.
New branch changes only independent audit reference, local intake QA, CI and operator runbook. No duplicate backup exporter, no second signer, no competing Store migration.

## 1. VERIFIABLE REAL OBSERVATIONS — sources and bounded interpretation

### Supabase staging: direct read-only SQL
- Project ifxlvrhyjhbzbrkdsida ACTIVE_HEALTHY PostgreSQL 17; core counts: 2 tenants / 2 products / 2 orders / 0 customers.
- **New material evidence:** auth.users count **3**, auth.sessions count **5**, public.tenant_memberships **3**. No identifiers, emails, raw JWTs, passwords or user rows read. storage.buckets count **0** and storage.objects count **0**, but external object storage and encryption/roles still require review.
- public.stores and public.store_memberships absent, products.store_id/orders.store_id absent; same-Tenant two-Store JWT-RLS cannot be independently proved.
- Legacy public.qa_shop_b_zalo_claim SECURITY DEFINER owned by postgres; anon EXECUTE=true; Supabase Security Advisor warns. Other authenticated definers need separate review. No RPC invocation or permission change performed.

### n8n/Meta: DIRECT execution evidence
- Published Messenger Z7FdV7uDvApfbURQ remains 27 nodes/version d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92; prior PR #211 confirms user visibly received LIVE01.
- Re-read real webhook #4176 directly, SUCCESS. Verify Signature Timing-Safe.verified=true; Verify Meta Signature.verified=true; Messenger AI Agent executed; Verify Messenger Send Result exposed a nonempty Meta message ID and deliveryAcceptedAt (only booleans recorded here). No Order writer node executed in that event. No PSID/Page ID/message content or Meta token reproduced.
- Actual webhook delivery and Page sender HMAC are not native Page administrator/App authorization or Merchant→Store permission. A real Studio canary/commerce writer is not released.
- Zalo V1 ingress yIJk8LvJoLF40Z62 and V2 Shadow OgDZNSAvKEvhnAvn active; shadow still includes POST to legacy RPC. Zalo Bot is not Zalo OA. Native OA ownership/OAuth/App authorization not independently inspected.

### Caller inventory: new source-level checking
- Connected Cloudflare account: GET list of 23 Worker scripts, GET source for **23/23** successful; only aggregate flags returned, never Worker code/tokens.
- Exact literal **qa_shop_b_zalo_claim: 0 scripts**; generic /rest/v1/rpc/ path literal: **13 Worker scripts** (BIO family); reference to ifxlvrhyjhbzbrkdsida string in **5 Worker scripts**. Neither proves the named RPC is called nor proves that there are no dynamic/external calls.
- Supabase latest available log window aggregate: postgrest_logs=7, edge_logs=14; pattern scan on selected attributes had zero named legacy RPC string or /rest/v1/rpc/ string. This is NOT signed real caller absence evidence. Cloudflare Pages/Workers routes, other accounts, manual operators and raw request owners remain UNKNOWN.
- Supabase Edge Function tien404-r1-owner-preflight ACTIVE verify_jwt=true. Current bounded code inspection lacks exact legacy name, not an exhaustive caller proof.
- Prior CBOT-UAT03 PR #206 inspected 19 active n8n graphs out of 115 accessible workflows and identified one literal old RPC caller in V2 Shadow; no other account coverage is claimed.

### Private evidence and browser
- No real backup file is mounted for this task; working container only has public QA CSV fixtures. The earlier H11R partial app archive/restore does not demonstrate independent complete 3-user Auth, sessions, Storage objects/roles/ACL recovery.
- Connected browser tabs include Facebook home but not authenticated Meta Business/Page or Zalo OA admin verification. Do not convert a Page URL or webhook HMAC result into merchant Page ownership.
- No independent Controller, Reviewer, Backup Operator, Merchant Owner or Channel Operator with externally validated identity and complete native provider/Store evidence was provided in this turn.

## 2. IMPLEMENTED artifacts, what they DO NOT mean
1. qa/cbot-uat05/observed-hosted-authority-metadata.json — directly read source-level counts, execution evidence and bounded Cloudflare/log observations with explicit limits, no customer PII or secret.
2. qa/cbot-uat05/real-evidence-intake.mjs — source-only classification of the above plus seven-field opaque private vault receipt refs; rejects raw URLs, extra secret/path fields, invalid digests, role/provenance/status spoofing and duplicate evidence kinds. Even eight valid references can never approve a live operation: independent private reviewer validation is **outside** code and remains PENDING.
3. qa/cbot-uat05/report-cli.mjs — offline sanitized NO-GO status; no live network or provider request, no vault read.
4. qa/cbot-uat05/real-evidence-intake.test.mjs — 31 source positive/negative tests for honest blocker separation, Meta HMAC vs owner, Zalo Bot vs OA, Storage=0 vs full restore, partial log count vs caller absence, forged all-green and private receipt input injection.
5. docs/ai-handoff/CBOT_UAT05_REAL_OPERATOR_NATIVE_AUTHORITY_RUNBOOK.md — practical Windows local-only existing archive inspection from PR #198, native read-only Meta Page/App permission check, native Zalo OA/App OAuth check, Owner row mapping, six-domain caller cutover and handoff with independent reviewer.
6. CI GitHub workflow source-only test + inherited 238 UAT04/UAT03/UAT02/UAT01/V16.7 source tests, redacted report; no disposable DB or real provider cost added since earlier PG17 regressions already validated.

## 3. ACCEPTANCE and blockers
- HOSTED_METADATA_READ_ONLY: **VERIFIED**.
- M0_FULL_INDEPENDENT_AUTH_STORAGE_ACL_REAL_RECOVERY: **BLOCKED**. No one-time actual export consent, no independent off-host restore receipt. External review of existing archive MUST precede any new export.
- M1_REAL_MERCHANT_OWNER_STORE_ROW_MAP: **BLOCKED**. Four current legacy Product/Order rows have no proven Store, do not guess.
- M2_TWO_STORE_OWNER_SAME_TENANT_JWT_RLS: **BLOCKED**. No canonical hosted Store schema or authenticated non-privileged tenant/store proof.
- META_NATIVE_PAGE_APP_PERMISSION_OWNER: **NOT VERIFIED**, despite LIVE01 HMAC and user-visible reply.
- ZALO_NATIVE_OA_APP_OAUTH_OWNER: **NOT VERIFIED**, despite staging Zalo Bot workflows.
- RPC_SIX_DOMAIN_CALLER_CUTOVER: **BLOCKED**, known active old RPC path and incomplete external caller domain.
- CUSTOMER_PSID_ZALO_UID_TRUSTED_LINK: **BLOCKED**.
- HOSTED_STORE_COMMERCE_ORDER_READ_ONLY_PILOT: **NOT RUN** (cannot be authorized by source-only reference or order ID alone).
- RPC_REVOKE / MIGRATION / LIVE_SEND / HOSTED_ORDER_WRITE / PRODUCTION: **NO-GO**.

## 4. Independent QA and rollback
No production/Published changes, no credential use or token leak, no hosted grant/DDL/DML/backup export/restore, no real messages or paid model calls. The only live reads were aggregates, metadata, current Worker scripts with no script contents emitted, and sanitized Messenger runtime receipt.
Source CI exact PR HEAD must complete SUCCESS before reporting TESTED. Closing Draft PR reverts additive files only; no hosted rollback necessary. Existing inactive n8n QA workflows remain separate and untouched.

## 5. Requested next independent evidence
Human-approved PRIVATE Windows existing archive coverage receipt (PR #198), then real off-host recovery including Auth, ACL and external assets; independently signed four-row Owner→Store mapping and two Store Owner JWT isolation proof; native Meta Page and Zalo OA app administration reviewed by an authorized person and independent reviewer; six-domain old RPC caller inventory with signed real request/no-caller transition evidence. Never paste raw archival data/PSIDs/tokens in this conversation or public GitHub.
