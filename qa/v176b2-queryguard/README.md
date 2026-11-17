# TIEN404 V17.6-B.2 — Trusted Commerce Reader Query Guard (source-only)

**State:** CANDIDATE, not APPROVED. **Release:** `PRODUCTION_NO_GO`.
Parent: V17.6-B.1 Draft PR #314 (`work/v176b1-independent-core-policy-nosend-ci-20261117`), planning #307/#301/#297.

## Existing source, not a rewrite

This package imports `../v176b1-core-admission/independent-core-adapter.cjs`, which calls the existing `../v171l-bot-security/zero-trust-bot-boundary.cjs`. No existing Core/security source is edited by this stage.

**Fix for B.1 demonstrated gap:** B.1 permits a model-proposed natural-language `query` to reach `SOURCE_ONLY_READ_PLAN` when the mock catalog callback approves. B.2 accepts **only** `{action:'READ_PUBLIC_CATALOG',sku:'SKU_A'}` under a server-admitted session and the actual V17.1L mock scope; free text is structurally forbidden, not heuristically allowed after scanning for keywords. Models cannot set Tenant/Store, route, customer, SQL, HTTP URL, filters, sort, or order fields. The SKU must be strict ASCII, syntactically bounded and **also** exist in the server-scoped synthetic catalog. User/product/RAG/URL text is never passed through as a reader query.

Natural language product search is **not implemented** by B.2. A future approved separate normalization contract may map it to a trusted SKU, but must not bypass the same server Store and RLS checks. False denials are preferred over cross-store reads at this stage.

## No-send contract

B.2 produces an immutable `SOURCE_ONLY_READ_PLAN` with `executeAllowed=false`, `data=null`, `actualDatabaseReads=0`. No reader, Supabase SDK, provider, n8n, LLM or network adapter is present. The test uses a *public QA-only HMAC test vector*; it is NOT Meta native signature proof, OA owner authorization or Supabase JWT validation. The in-memory counters cannot prove network-isolation at OS level.

## QA / CI

```bash
node --test qa/v176b1-core-admission/independent-core-adapter.test.cjs
node --test qa/v176b2-queryguard/trusted-catalog-read-plan.test.cjs
node qa/v176b2-queryguard/no-send-query-canary.cjs
```

All test cases and their expected deny codes are in `trusted-catalog-read-plan.test.cjs`. GitHub Actions workflow `v176b2-trusted-reader-no-send.yml` uses SHA-pinned checkout, no npm/pip install, no app secrets, a private-write-free synthetic test fixture and a fail-closed 12-case canary (2 successful plans/10 denials). A CI green check means **only source-level guard acceptance**, not end-to-end hosted JWT acceptance.

## Independent prerequisites for any real Commerce Reader integration

1. Merchant Owner / authorized Staff A and B have verified, independently obtained **real Supabase Auth** sessions, with a **single Tenant but different Store IDs** and explicit active Owner/Staff membership.
2. Auth identity is derived server-side using verified JWT/session, never client `raw_user_meta_data` or model text.
3. Store-scoped table columns and policies are implemented and tested on **disposable** database before hosted review; no tenant-wide legacy Core table is treated as store-isolated.
4. Reader uses user-scoped JWT with least privileges; dedicated reader architecture and grants are approved. No service-role client and no `SECURITY DEFINER` shortcut.
5. Negative/positive A-to-A, A-to-B, B-to-B, B-to-A `SELECT` and no `INSERT/UPDATE/DELETE` under these roles, and a strict no-send/outbox lock.
6. Meta/Zalo signature/provider installation proof is a different admission gate; **not** satisfied here. 
7. Private UAT records hashed principal/Store references, timestamps, scope decisions and zero-send receipts; no JWT tokens, client PII or credentials committed.

See `HOSTED_JWT_ADMISSION_REVIEW.md` for current metadata-level verification and gaps.

## Rollback

Close B.2 Draft PR. Only new source-test/docs/CI files are added to B.1 QA branch; no production application, gh-pages, Supabase migration, credential, customer data, AI model spend, n8n published workflow or provider send is changed.
