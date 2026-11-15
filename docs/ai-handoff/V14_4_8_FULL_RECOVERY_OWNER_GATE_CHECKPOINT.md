# TIEN404 AI V14.4.8 — Full Recovery Dependency Gate × Four-Row Ownership Evidence

Date: 2026-11-16 JST. Supabase project: tien404-staging (ifxlvrhyjhbzbrkdsida).
Base branch: V14.4.7 Draft PR #109. Status: EXPERIMENTAL / SOURCE-ONLY.
No live database modification or migration authorization.

## 1. Direct hosted Supabase audit (VERIFIED)

The checked-in file qa/recovery-owner-v1448/HOSTED_DEPENDENCY_SELECT_ONLY.sql
was executed via Supabase plugin with SELECT-only catalog and anonymous
aggregate queries. No row/user/tenant/customer IDs were returned.

- PostgreSQL version 17.11.
- 3 hosted Auth users (count only).
- 7 app tables, 9 total foreign keys to auth.users.
- 2 existing Products, 2 existing Orders.
- 2 anonymous tenant groups, each with 1 Product + 1 Order.
- Group #1 has 2 active owner memberships; group #2 has 1.
- All three owner memberships reference existing Auth rows.
- Canonical stores/store_memberships tables are absent.

FK graph by application table (names and counts only):
public.tenant_memberships=1
public.tien404_tester_access=2
public.tien404_tester_google_sheets=1
public.tien404_tester_requests=2
public.tien404_tester_runs=1
public.tien404_tester_staff=1
tien404_r1_qa.owner_pairing_challenges=1

The snapshot qa/recovery-owner-v1448/HOSTED_AGGREGATES_REDACTED.json is
privacy-safe point-in-time metadata, NOT a merchant Store ownership proof.

## 2. Local restore reconciliation (PARTIAL VERIFIED)

Operator screenshot evidence proved local Supabase PostgreSQL 17.11 can
read the app-only backup archive. Full-data restore was attempted but failed
the app tenant_memberships-to-auth.users FK, because source Auth user data
was not included. Single-transaction rollback was independently checked.
Schema-only restore completed, exit 0: 38 tables, RLS 38/38, FORCE 12;
31 public RLS policies. No-JWT negative Product RPC test returned denial
and was rolled back. --no-owner and --no-privileges mean local ACLs cannot
be treated as the hosted ACL baseline.

FULL application+Auth data restore and accepted recovery rollback BLOCKED.

## 3. Source-only artifacts

- qa/recovery-owner-v1448/recovery-owner-gate.cjs:
  fail-closed structural guard for Auth FK graph, restore evidence and
  individual Store ownership evidence. Always refuses hosted SQL/backfill.
- qa/recovery-owner-v1448/recovery-owner-gate.test.cjs:
  25 new synthetic negative/positive tests.
- qa/recovery-owner-v1448/HOSTED_DEPENDENCY_SELECT_ONLY.sql:
  real read-only query, successfully executed via plugin.
- qa/recovery-owner-v1448/HOSTED_AGGREGATES_REDACTED.json:
  no raw identifiers.
- docs/ai-handoff/V14_4_8_PRIVATE_RECOVERY_OWNER_EVIDENCE_RUNBOOK.md:
  private operator checklist for recovery R0-R5 and P01/P02/O01/O02.
- .github/workflows/v1448-recovery-owner-gate-qa.yml:
  offline tests, reuses prior private evidence and Store A/B suites, static
  read-only SQL check; never contacts Supabase or uses hosted credentials.

Existing four-row private evidence linter from V14.4.3 was reused, not
rewritten. It cannot verify true signatures or grant Store ownership.

## 4. Hard release gates

BLOCKED: coherent encrypted backup covering dependent Auth and app records;
independent full restore and rollback; four original records individually
attested by merchant Store authority and independent reviewer; Store schema;
atomic replacement of six old tenant-wide permissive SELECT policies;
Product V2 scoped writer and legacy integration; real independent signed JWT
Store A/B/C/revoked acceptance; separate hosted change approval.

One tenant group has two owners, but even a unique owner would not
independently establish Store ownership of a Product or Order. No guessing,
automatic mapping or blind backfill is authorized.

## 5. Rollback and next

Only GitHub source-only Draft files were added; no Supabase hosted schema,
data, permissions, credential, n8n Published workflow, Meta/Zalo messages or
billing changes occurred. Source rollback is close/revert Draft PR.

Next: obtain independent permission for private consistent full recovery
rehearsal and merchant-attested per-row Store mapping. Do not repeat the
successful prior local schema-only restore. Do not advance hosted Store RLS
until the new recovery and four-row Store ownership gates are certified.


## 6. Verified GitHub CI / final hosted read-only recheck

- Draft PR: https://github.com/ngoctien20/demo-git/pull/111
- GitHub Actions run: https://github.com/ngoctien20/demo-git/actions/runs/43744946738
- Source-only CI job 132906071280: COMPLETED SUCCESS.
- **72/72 Node tests PASS** (25 new V14.4.8, 36 inherited private evidence V14.4.3,
  11 inherited V14.4.7 Store QA); 0 failures/skips.
- CI metadata-only SQL + anonymous snapshot static guard: PASS.
- Post-CI Supabase read-only recheck: PostgreSQL 17.11, Auth users 3,
  Products 2, Orders 2; Stores and Store Memberships absent;
  6 old permissive tenant-wide SELECT policies still present.
- No SQL migration or data writes were performed on Supabase hosted.
- **FINAL VERDICT:** V14.4.8 source-only QA VERIFIED/TESTED PASS;
  actual full backup+Auth restore, owner-to-Store mapping and hosted JWT
  Store RLS remain BLOCKED. The project is NOT merchant-ready.
