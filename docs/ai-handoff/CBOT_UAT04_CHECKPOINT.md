# TIEN404 CBOT-UAT-04 — Private Recovery Acceptance × Trusted RPC Replacement × Hosted Read-Only Pilot
Date: 2026-11-16 JST
Mode: EXPERIMENTAL → CANDIDATE source only, NO SEND, NO HOSTED WRITE, NO RPC GRANT/REVOKE.
Parent checkpoint: CBOT-UAT03 Draft PR #206 HEAD abbc76b9b1818c8e8343aab06998e7b31702ae06.
Related independently owned branches: H11R.11 #205, H11R.10 #200, RPC.7 #198 (updated bca8131d04b9ddcef67b132fea52d192082646db), native Meta/Zalo operator evidence #196, Messenger LIVE01 #210, CBOT-MSG UAT #209.
Never merge these parallel security/workflow branches automatically or duplicate Store schema.

## A. LIVE VERIFIED read-only audit 2026-11-16
- Supabase staging project ifxlvrhyjhbzbrkdsida ACTIVE_HEALTHY, Postgres17. Query run directly as SELECT only using Supabase connector, read metadata and aggregated counts, no personal/order row contents:
  tenant_count=2,product_count=2,order_count=2,customer_count=0,
  stores_present=false,store_memberships_present=false,
  orders_store_id_present=false,products_store_id_present=false,
  legacy_rpc_exists=true,legacy_rpc_definer=true,legacy_rpc_anon_execute=true,
  orders_rls_policy_count=1.
- Supabase Security Advisor remains WARN: public.qa_shop_b_zalo_claim SECURITY DEFINER anon executable. Other authenticated SECURITY DEFINER functions still require separate review. Privilege warning does NOT by itself prove abuse, but cannot be ignored.
- Published Zalo V1 yIJk8LvJoLF40Z62 → active V2 Shadow OgDZNSAvKEvhnAvn contains an enabled HTTP POST to old RPC. No direct REVOKE due to unknown caller population.
- Published Messenger Z7FdV7uDvApfbURQ still invokes legacy AI_SALES_DEMO Google Sheets/Orders tools; do not copy credential or repoint Published. Independent PR #210 read-only verified real Meta webhook #4176 HMAC true, Meta Send accepted MID, zero business tools; this is a LIVE greeting baseline, not Commerce ordering, real Page Custom Studio or cross-channel lookup.
- The project has NO canonical multi-Store hosted ownership and no signed Owner A/B same-Tenant hosted JWT denial proof; current tenant RLS cannot count as Store isolation.
- H11R.11 #205's Ed25519 signed synthetic evidence and disposable recovery are not actual independent full Auth/Storage/ACL/platform recovery. No real encrypted off-host restore receipt or signed merchant Store row mapping has been supplied. Do not call this PRIVATE RECOVERY ACCEPTED.

## B. Implemented this branch
1. qa/cbot-uat04/trusted-rpc-replacement.mjs: **candidate admission service**, no HTTP route or Supabase deployment. Accepts only exact-shape attestation signed Ed25519 by pre-enrolled private gateway issuer, pinned audience, 120s max TTL, strict fields, six-domain external caller prerequisite out of band, immutable account/channel→Tenant/Store mapping, externally provided atomic nonce consumption, and read-only inherited UAT02 synthetic order lookup with identity linking. Uniform denied response without PII. Separate legacy owner-pairing claim remains BLOCKED_PRIVATE_OWNER_PROOF; not falsely replaced with order lookup. Diagnostics explicitly state native provider signature, real Owner and hosted JWT remain UNVERIFIED.
2. qa/cbot-uat04/private-recovery-hosted-preflight.mjs: emits sanitized NO-GO report and exact checklist using real read-only hosted metadata. Cannot authorize export, migration, privileged ACL change, Published Messenger, provider sends, or hosted order lookup even if self-reported metadata is all green. H11R.11 retains the independent private evidence intake — no duplicate signer or forged authority.
3. qa/cbot-uat04/hosted-readonly-preflight.sql: reproducible metadata-only hosted SELECT, exact query executed as part of this task. No DDL/DML or real order contents.
4. qa/cbot-uat04/disposable-pg17-trusted-rpc.sql: executable ephemeral PostgreSQL17 mechanical proof: private SECURITY INVOKER function with pinned empty search_path and role-specific EXECUTE, anon deny; Store A/B same Tenant and C different Tenant non-owner RLS; revoked membership denied; simulated old RPC coexistence; no writer grants; ROLLBACK and verify empty schema. This does NOT test real signed JWT/Meta/Zalo consent or Privileged H11R11 caller cutover.
5. 38 trusted gateway cryptographic and access negative/positive tests + 18 hosted preflight/security checks (56 NEW); CI additionally inherits UAT03 35+22, UAT02 38, UAT01 22, V16.7 65 (182 inherited), total 238 source/synthetic assertions, plus disposable PG17. Do not claim TESTED until exact HEAD CI is SUCCESS.

## C. Recovery acceptance Gate M0 — BLOCKED
Reuse existing archive and PR #198 operator path, do not export again simply for a green test.
Exact independent private authority: legal Controller, separate Reviewer and Backup Operator, fresh encrypted offsite app data+Auth+ACL/roles+Storage metadata AND object bytes, key custody, manifest SHA evidence, time-bounded true recovery on distinct host, row/integrity and authentication tests, RPO/RTO, retention and rollback. Never upload actual archive, tokens, raw user IDs or backup to public GitHub/CI/chat.
The H11R11 signed metadata intake can validate packet cryptography but even all-green packet does not represent a human independent examiner. Real M0 remains NOT_ACCEPTED. This branch does not perform any backup, restore, export or private vault operation.

## D. Store Ownership Gate M1 — BLOCKED
Existing two Products + two Orders need independently attested Owner→Tenant→Store row attribution. Two Tenant Owners are not two Store Owners. Reuse H11R.10 PG17 migration compatibility and H11R.11 four-row signed evidence; no auto-backfill. Require a real private recovery first, exact expand-only migration diff, rollback plan, same-Tenant Store A/B Owner JWT and RLS negative tests under non-privileged role. Existing hosted table has no stores/store_id. No hosted DDL or data migration.

## E. RPC replacement Gate — CANDIDATE ONLY
Old public.qa_shop_b_zalo_claim remains callable from anon; active Zalo V2 shadow references it. This branch does not replace it on hosted.
Proposed cutover after M0/M1 and real native provider authority:
  G1: inventory all real n8n Published/draft, Workers/Pages, Supabase Edge, websites, external/manual clients and PostgREST request-log consumers, record UNKNOWNs;
  G2: independent external provider OAuth/Page/OA proof + real signed raw webhook verification by private gateway, ownership and Store binding; no client-supplied tenant/store/role;
  G3: private non-public scoped service with atomic persistent nonce ledger, TTL/rate limiting and strict immutable session; sensitive tokens stay in encrypted server secret store;
  G4: shadow-only response equivalence on authorized QA channels (no outgoing messages or Order write);
  G5: approve exact no-downtime caller cutover + rollback, independently verify zero remaining legacy caller; THEN separately approve exact function EXECUTE REVOKE and re-run Advisor;
  G6: only after complete real Store JWT QA and QA Order receipt permit read-only hosted pilot.
Note: gateway Ed25519 signature alone does not verify Meta HMAC / Zalo OAuth event, legal merchant ownership, or Customer identity. Test key signatures in CI are synthetic.
Supabase official docs recommend SECURITY INVOKER for accessible RPCs and explicit grants; SECURITY DEFINER owned by postgres may bypass RLS. A private schema invoker function and non-privileged identity are preferred for read-only access.

## F. Hosted Read-Only Pilot — status
Real hosted metadata preflight: EXECUTED / VERIFIED. Real per-Store Order Lookup pilot: BLOCKED (schema, recovery, native provider and JWT evidence).
Target route: authenticated Messenger/Zalo raw event → verified provider/channel ownership → private trusted gateway → cross-channel customer proof → Store-aware Commerce read-only repository under real RLS → scoped response/No-Send dry run → separate Owner-approved real provider UAT.
The old Google Sheets DEMO Orders are excluded entirely. One actual synthetic Commerce QA Order can only be created after a separate approved store-aware QA writer and validated M0/M1; order code alone never authenticates.

## G. QA evidence, risk, rollback
Source code and ephemeral PostgreSQL tests can be independently run via Actions; exact HEAD required. No direct live Messenger/Zalo send initiated in this task.
Severity: P0 open = Store Isolation, anon privileged RPC, full recovery and native Page/OA authority. P1 open = 9 digit auto-prefix remains in Published Messenger Order Status; UAT03 Candidate rejects this input but Published not edited.
Rollback: close new Draft PR, no hosted change to reverse; delete only ephemeral CI database. Do NOT roll back existing Published n8n or older PRs.
Operator next required actions: private real M0 recovery acceptance, four-row Store ownership proof, six-domain caller attestation and native Meta/Zalo ownership before exact hosted mutation is individually approved.
