# TIEN404 AI — V17.1R Ephemeral Receipt Hardening × Owner JWT × Signed Provider Canary

Checkpoint: 2026-11-17 JST
Parent: Draft PR #293, V17.1Q HEAD `f56a2d63256f99a85cd02fac7ca3b1a9de9d9ef4`.
Status: new source-only candidate, no live deployment, no real owner approval admitted.

## 1. VERIFIED READ-ONLY project status before modifications

- Messenger `Z7FdV7uDvApfbURQ` Published V17.17 version `1064b1b3-d3f1-4a6b-a367-2414ba691522`, 32 nodes and all four V17.15 original nodes present.
- Zalo Lab `yIJk8LvJoLF40Z62` Published V17.19 version `2d912cb0-007f-452f-9536-b92ba12a03e6`, unchanged.
- V17.1P QA workflow `p5OsIaB0NkMDFMw7` INACTIVE, Code-only, no credentials, callerPolicy none.
- Supabase `tien404-staging` ref `ifxlvrhyjhbzbrkdsida`: two mapped Store records in TWO different tenants, ZERO qualifying two-Store owners under SAME Tenant and ZERO two independent session+active-membership users under same Tenant. Legacy core orders/products/customers have zero Store-scoped RLS policies. Query was read-only, aggregate only, no individual IDs/tokens/PII.
- `public.qa_shop_b_zalo_claim` remains SECURITY DEFINER executable by anon; this is a P0 function review candidate, not a proven vulnerability. No RPC executed.

## 2. Security hardening implemented in child Draft source only

New `qa/v171r-private-uat/private-admission.cjs` is based on exact V17.1Q version `qa/v171q-private-uat/private-admission.cjs` without changing parent, n8n or live workflows.

1. JWT JWKS kid uniqueness: reject multiple public JWK objects with the same kid (ambiguous cryptographic signing key admission) rather than silently using first.
2. JWT verifier no longer returns the raw claims/user metadata in an easily logged result; only internal subject and session ID are passed to private callbacks.
3. Opaque owner/provider receipts gain a **60-second server-clock TTL** and fail closed if expired or from future clock time.
4. Receipt consumed **once only** for catalog plan, order-status plan or private no-send owner/provider canary. Provider receipt reused for a different operation is denied.
5. Own-order receipt is consumed before asynchronous customer challenge grant lookup to block simultaneous duplicate reads; failed grant attempts still consume receipt.
6. Owner/provider receipts are both consumed for a private canary binding attempt before cross-Store matching, preventing repeated inappropriate binding attempts.
7. The module continues to contain no API/webhook server, HTTP request, Auth refresh, real external database, LLM model, provider send, Commerce write, app secret/JWT import or background job. All secret/JWT/session checks require future private host adapter callbacks.

Receipt lifetime and one-use controls do **not** themselves make external replay service durable; provider event admission continues to require a separately hosted atomic replay reservation, session liveness, owner registry and secret manager.

## 3. Independent QA

- `qa/v171r-private-uat/private-admission.test.cjs`: source QA derived from the V17.1Q suite (66 prior cryptographic tests) plus **16 additional hardening tests**, including duplicate kid, no raw claims disclosure, TTL, multiple uses, concurrent own-order access, cross-Store canary rejection, and replay.
- GitHub CI runs new 82-case source suite + inherited earlier n8n/Commerce source regressions of V17.1P–V17.1D (855) = **937 independently executed tests** once CI confirms the result. Do not add the separate 84-case user-visible portable ZIP test count.
- Disposable PostgreSQL 17 CI replays verified V17.1N same-Tenant Store A/B RLS temporary-table test and ROLLBACK, expressly **NOT actual two Supabase Auth JWT sessions**.
- CI hosted real-owner signature/JWT gate must be deliberately RED (NO-GO). Do not remove that gate to make Actions all green.

## 4. Real UAT entry gates (NOT SATISFIED)

1. Owner/operator authorizes two independently signed-in QA users owning different Stores in SAME Tenant, approved separate staging dataset and role evidence; don't relocate existing live Store owners or extend real customer privileges.
2. Private trusted Auth server verifies actual Supabase JWT signature, issuer, audience, session, expiry, subject, and current Store ownership. Do not put JWTs, refresh tokens or credentials in GitHub/n8n logs/chat.
3. Private QA Meta Page/App, Zalo QA OA/App and managed secret authorizations; native provider-signed no-send raw webhook canary with independent verifier and atomic durable replay; no public reply.
4. Dedicated least-privilege Commerce Reader with tested Store RLS, customer OrderAccessGrant and denied cross-Store reads on approved fake QA rows, never postgres/service_role bypass.
5. Independent QA reviewer verifies signed receipt and actor identity, tests revocation/replay, and signs off before requesting any live change.

## 5. Change, risk and rollback

Source-only child Draft PR. No n8n workflow created or modified in V17.1R, no Supabase SQL writes or migration, no real Auth identities/memberships, provider secrets, webhook, orders, payments, customer messages or production deploy. The original V17.1Q source remains available for diff and rollback.

Rollback: close this child Draft PR. Existing Published bot workflows remain untouched. Real Hosted release must remain NO-GO until independent identities and signed provider evidence exist.


## 6. VERIFIED CI and acceptance receipts — 2026-11-17 JST

- Tested candidate SHA: `72a36b8b6e7957cf17de295bc8bd052fd10fda39`.
- GitHub Actions [run 44059873621](https://github.com/ngoctien20/demo-git/actions/runs/44059873621):
  - `133958664255` **SUCCESS** — 82/82 cryptographic identity, TTL/one-use receipt and cross-Store canary tests, plus 855/855 inherited independent regressions; **937/937 source PASS**.
  - `133958664409` **SUCCESS** — disposable PostgreSQL 17 same-Tenant Store A/B RLS on temporary rows, transaction ROLLBACK and cleanup. **NOT real Supabase JWT or Commerce RLS proof.**
  - Real hosted Auth/JWT + Meta/Zalo signed-owner gate is deliberately **HOSTED NO-GO** (intentional failure). Never convert source-only proof into hosted release.
- Initial candidate commit `4f108c2fae0fe45257c030a2838054a53c36ef8a` had 81/82 source tests PASS because an unknown JWT `kid` returned the new ambiguous-key reason. The separate zero-key branch was restored to `JWT_KEY` and duplicate-key branch remains `JWT_KEY_AMBIGUOUS`. No cryptographic or access check was weakened.
- Real owner and provider signed event proofs remain unavailable. Supabase still lacks same-Tenant 2 distinct mapped Store owners, and legacy core policies lack Store-scoped predicates. No live workflow, provider sends, n8n credential, Supabase Auth, permanent DB, orders, stock, payment or customer data modified.
- Checkpoint-only documentation update changes branch HEAD, so verify the new final SHA's GitHub source and PG17 results before final handoff.

**Status**: IMPLEMENTED source / TESTED independent cryptographic regression / TESTED disposable PostgreSQL 17 / REAL AUTH OWNER & NATIVE PROVIDER NO-GO / LIVE UNCHANGED.
