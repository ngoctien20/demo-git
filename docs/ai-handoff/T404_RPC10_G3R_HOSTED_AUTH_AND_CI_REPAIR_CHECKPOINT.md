# TIEN404 RPC10-G3R — Canonical Store RLS CI Repair and Real Auth Eligibility

Date: 18 November 2026 JST. Mode: READ-ONLY hosted audit + SOURCE-ONLY GitHub CI repair. Hosted Store JWT and Commerce release: NO-GO.

## Source lineage
Canonical Store migration owner: Draft PR #247, HEAD e25d8e203143e5079f6204ccacdefd44caafe604.
Related work: PR #383 cross-channel Zalo/Messenger No-Send, PR #379 disposable real JWT contract, PR #385 three privileged RPC negative PG17, PR #382 optional Windows backup kit. Preserve all.

## Confirmed P1 regression in canonical CI source
GitHub workflow .github/workflows/v152-rpc10-six-surface-nohost.yml at #247 HEAD contained an unterminated Python SQL COMMIT regex at line 63; two PG17 jobs were accidentally inserted into the middle of the Python heredoc, resumed with broken no_comments text at line 164, and then duplicated again. The current original #247 HEAD has no workflow run surfaced by the commit-run query. Older successful run 43996434462 belongs to an earlier commit and is not proof of the current YAML.

This child branch makes a precise SOURCE-ONLY repair: restores the COMMIT SQL regex, removes the accidental duplicate middle block, and preserves the original three CI jobs: Node/G0 source gate, disposable PG17 six-surface Store A/B/C with rollback, and disposable concurrent reader COMMIT/ROLLBACK. Strict t404_rpc8_ci + RPC8_DISPOSABLE guard retained. No original schema migration or disposable test SQL is edited.

## Current Supabase staging evidence, SELECT only
Ran the EXACT committed SQL: qa/v152-rpc10/g3r-hosted-auth-eligibility-readonly.sql through the connected staging Supabase project ifxlvrhyjhbzbrkdsida. The query returned only aggregates, no user UUID, customer data, Order row, token or private evidence.

- Public Commerce six tables: 6/6 RLS + FORCE, 6/6 tenant_id, ZERO store_id.
- Six permissive Tenant SELECT policies, zero Store-qualified SELECT predicates.
- QA mapping 2 Tenants, ZERO two-Store QA Tenant mappings; public.stores and store_memberships ABSENT.
- **One real Tenant has TWO DISTINCT Auth user IDs with ACTIVE Owner memberships.** This is evidence that two Auth user slots exist, NOT independent verified real JWT sessions or two Store owners.
- 3 public SECURITY DEFINER RPCs, 1 anon-executable and 2 authenticated-executable. Findings need caller/privilege review, not automatic revoke; no actual exploit is claimed.
- 2 Bot identities synthetic_qa/dry_run; 2 owner_bindings status paired; neither establishes real merchant rights.
- No original 4 Product/Order rows attributed to independently signed original Store ownership.

## Source files changed
1. Repair existing GitHub Actions workflow (malformed heredoc and duplicated jobs).
2. g3r-hosted-auth-eligibility-readonly.sql: metadata-only current audit.
3. g3r-hosted-auth-eligibility-evidence.json: sanitized observed values.
4. g3r-hosted-auth-eligibility.cjs and .test.cjs: strictly offline evaluator with eligibility and negative tests; permits NO hosted DDL, real JWT test, Store Order reads, RPC permission change or provider sends even when given all-green self reports.
5. v180-rpc10-g3r-hosted-auth-nohost.yml: exact evidence, Node suite, SQL read-only guard, and strict check of repaired inherited workflow.
6. This checkpoint.

## Exact safe next steps and gates
G0: independently authenticate owner + original Store for the four legacy Product/Order rows. Current Tenant membership/order_source/Bot registry is insufficient.
M0: user previously deferred redundant local backup evidence; skip it for SOURCE-ONLY and disposable PG17, but require owner-approved recoverable hosted scope and rollback before live database/RLS or privileged grant changes.
M1: canonical migration only under PR #247 after G0 and approved M0. Review old calls and SQL writer save_merchant_product, which remains tenant-scoped, before Store cutover.
M2/M4: replace old permissive Tenant policies ATOMICALLY, do not add another permissive policy while old Tenant-read remains (PostgreSQL OR composition); test reader blackout and abort/rollback under current PG17 disposable job.
G3: do not treat two existing Auth IDs as signed JWT sessions. First obtain independently verified active sessions and same-Tenant Store A/B memberships, then test 6 tables with A own allow/A to B deny, B own allow/B to A deny, revoked owner denial and hostile IDOR.
CHANNELS: only after G3, trusted provider Bot/Page mapping + opt-in customer Messenger-to-Zalo identity link + actual one-event No-Send acceptance. Existing Zalo Bot stays connected and unmodified.

VERIFIED: metadata and malformed CI source.
IMPLEMENTED: repair and source-only G3R tests/checkpoint.
TESTED: only after independent CI at exact new PR HEAD.
BLOCKED: real Store A/B Auth JWT, independent owner evidence, recoverable hosted rollout, cross-channel status.
CHANGED: GitHub Draft files only. No Supabase hosted SQL writes, Auth account changes, n8n Published, customer data, credential, Cloudflare deployment or provider send.
ROLLBACK: close child Draft PR, leave canonical PR #247 and hosted systems unchanged.
Decision: G3R_AUTH_OWNER_SLOTS_IDENTIFIED_BUT_STORE_AUTH_NO_GO.
