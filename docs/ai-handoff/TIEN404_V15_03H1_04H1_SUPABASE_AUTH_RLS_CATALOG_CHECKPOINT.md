# TIEN404 AI — V15.0-03H.1 × V15.0-04H.1
## Private Issuer Dependency Audit × Supabase QA Catalog Read Adapter

**Checkpoint date:** 2026-11-16 JST  
**Branch:** `work/v1503h1-04h1-auth-rls-catalog-readiness-nosend-20261116`  
**Draft PR:** https://github.com/ngoctien20/demo-git/pull/130  
**Parent:** V15.0-03H/04H Draft PR #127; V15 A–D Draft PR #123; V14.8 Draft PR #121.  
**Release classification:** `AUDITED → CANDIDATE_SOURCE_ONLY → TESTED_OFFLINE`; NOT HOSTED WITH AUTH / NOT COMMERCIAL / NO SEND.

## 1. Previous checkpoint and user approval
The Owner self-reported **7/7 PASS** for the V15 synthetic UI Test Lab. This is an ACCEPTED UAT for the **synthetic browser interface**, not certification of real Zalo ownership, backend tenant isolation or model quality. GitHub UAT source: `qa/v15-test-lab/v15-owner-uat-self-reported-7-of-7.json` in parent PR #123. Hosted static Worker and n8n execution #3886 previously passed read-only HTTP tests; Zalo send is disabled. User authorized safe continuation, not a paid model, credential, production merge, GRANT or real Orders write.

## 2. Supabase verified metadata, RLS and privileges (read-only)
Connected staging project: `ifxlvrhyjhbzbrkdsida`. These checks used SQL metadata and SELECT only, not direct tenant Auth JWT impersonation.

| Source | Verified state |
|---|---|
| `public.products` | RLS=true; FORCE RLS=true; one SELECT policy `products_member_read` for `authenticated` role; policy joins same `tenant_id`, active membership and `auth.uid()`. |
| `public.tenants` | RLS/FORCE=true, SELECT membership-based policy. |
| `public.tenant_memberships` | RLS/FORCE=true, SELECT only the logged-in user's active membership. |
| `authenticated` grants on `products` | SELECT=true; INSERT/UPDATE/DELETE=false. |
| `anon` grants on `products` | SELECT=false. |
| Shop A QA tenant | One active product and one active Owner membership. |
| Shop B QA tenant | One active product and two active Owner memberships. |
| `auth.identities` | 3 email identities; no Zalo identity. |
| `app_private.channel_secrets` | Zero Zalo channel rows. |

**Actual staging QA Catalog:** Shop A `QA-A001`, price **123,000 VND**, stock **5**; Shop B `QA-B001`, price **456,000 VND**, stock **5**. These are QA staging data, NOT the accepted V14.7 Test Lab products. No real customer data was copied or modified.

**Actual database constraints and indexes:** `UNIQUE(tenant_id, sku)`, `UNIQUE(tenant_id,id)`, `price_vnd >= 0 and <= 1,000,000,000,000`, `stock_on_hand >= 0`, valid name and SKU lengths; tenant+active index present. Current schema uses `tenant_id` for products and has no `store_id` column; two QA shops are represented as distinct tenants. Do not infer unrestricted multi-stores-per-tenant support.

**What is NOT verified:** JWT-backed Supabase Data API `SELECT` of actual Shop A/B users, cross-user RLS denial under a real browser session, subscription entitlement in the real user session, or public Messenger/Zalo Bot→Shop access. Reading `pg_policies` through the SQL Editor proves policy configuration, **not real tenant authorization**.

## 3. Catalog-source mismatch is an explicit commercial blocker
| QA scope | V14.7 static synthetic browser Lab | Current Supabase R1 QA |
|---|---|---|
| Shop A | `A001`, 159,000 VND | `QA-A001`, 123,000 VND |
| Shop B | `A001`, 209,000 VND | `QA-B001`, 456,000 VND |

These are deliberately separate fixtures, not a conflict in actual production data. The V15 UAT **remains accepted for its stated synthetic scope**, but those approved visual price displays cannot be used as real product prices. Auto-rewriting `A001` → `QA-A001`, copying UI prices, or silently falling back across stores is forbidden.

**Gate:** `CATALOG_SOURCE_MISMATCH` blocks V14.7 SKU in Supabase RLS adapter. Only exact `QA-[A-Z][0-9]{3}` is accepted by this **narrow staging** candidate (not a universal SKU pattern for paying merchants). Unknown SKU and wrong-store rows fail closed; real catalog read plans require a user-authenticated membership.

## 4. New 03H.1/04H.1 implementation, SOURCE-ONLY
- `qa/v15-hosted-readiness/qa-member-rls-catalog-adapter.cjs`: future private backend callback contract `verifyAccessToken`, `lookupMembershipWithUserJwt`, `readProductWithUserJwt`. Each must be implemented with the **same real user JWT** (getUser, member SELECT, product SELECT) and never with a service-role client.
- Strict input `accessToken,shopSlug,sku` only; pinned QA Shop A/B slugs, server-verified user UUID and active membership, exact same user/tenant, fixed source label, strict row tenant/SKU/is_active checks and valid integer VND/stock. No client tenant/store/role, price or membership claims accepted.
- `auditCatalogRls` produces **CONFIGURATION_VERIFIED_ONLY** when RLS policy/grants metadata matches; an ordinary metadata object **does not certify actual RLS execution or authorize public bot access**.
- The adapter is a code candidate with *mock trusted callbacks* for tests; no Supabase endpoint, service key, real JWT, website, n8n workflow or Cloudflare Worker binding. Public chat customers are not members in this policy; require **separate certified Bot→Shop resolver and customer-safe read contract** after V14.8/G2.3.
- `qa/v15-hosted-readiness/merchant-member-catalog-select-DRAFT.sql`: parameterized **SELECT-only**, redundant server-verified tenant slug and `auth.uid()` membership filter. **NOT EXECUTED** against live DB or made into a SQL RPC.
- Actual Supabase `price_vnd` CHECK permits 0. The candidate QUOTE adapter fails closed for price 0 until a `free-item/complimentary product` business policy is approved, and enforces the actual 1,000,000,000,000 VND upper bound. No invalid price is silently converted to zero.

## 5. Security Advisor surfaced real review dependencies
Supabase `get_advisors(type='security')` on 2026-11-16 JST reports:
- WARN `anon_security_definer_function_executable`: `public.qa_shop_b_zalo_claim` is a `SECURITY DEFINER` function callable by `anon`. Read-only source review confirmed a **Vault-backed guarded request header** is checked before delegating to `tien404_r1_qa.claim_owner_pairing_v3_synthetic`; the private function has **no direct anon EXECUTE or schema USAGE**, contains expiry and replay/state-update related logic. These facts **mitigate apparent exposure**, but do not prove real negative replay or prevent every abuse. **No exploit confirmed**. Permission change requires separate review.
- WARN `authenticated_security_definer_function_executable` on `public.qa_owner_pairing` and `public.save_merchant_product`. Read-only source metadata indicates both reference `auth.uid()`, membership, active status and owner/manager concepts; this does NOT establish full runtime permission safety. Real Owner/Manager and cross-shop negative tests still needed.
- WARN `auth_leaked_password_protection`; this is an Auth setting review, not automatically changed.
- INFO `rls_enabled_no_policy` count 18 in private/QA schemas; review their network/schema exposure independently. No automatic GRANT or RLS policy addition, as accidental exposure is worse than blocked private tables.

Official remediation links:
- https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable
- https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

**Security action taken:** audit only. NO `GRANT`, `REVOKE`, `ALTER FUNCTION`, `CREATE POLICY`, `UPDATE`, `INSERT` or credential changes.

## 6. CI and regression evidence
GitHub branch CI [43789498979](https://github.com/ngoctien20/demo-git/actions/runs/43789498979) **SUCCESS** on source+SQL draft commit:
- **54/54** previously signed P256 identity and QA read/draft tool-security suite.
- **54/54** new RLS Catalog adapter QA suite.
- Total **108/108 PASS**, static scan **PASS** for no network, external model, SQL writes, service-role token or active GRANT statements.

A preceding CI failed only because an over-broad static scanner matched the *word* `GRANT` in a code comment; scanner was corrected to detect SQL statement patterns. No database changes occurred and final CI PASS. Do not count this test as a real JWT Data API test or a production load test.

Additional original A–D suite was 137/137 PASS and Owner synthetic UI 7/7 self-reported. Keep independent run classifications rather than add them to an unsupported single regression total.

Evidence manifest: `qa/v15-hosted-readiness/supabase-catalog-rls-readonly-audit.json`. No JWT, email, phone, Zalo Token, signing secret or private key is stored.

## 7. Release gates, rollback and next milestone
| Gate | Current status |
|---|---|
| Source QA Catalog/A/B grants/RLS configuration | VERIFIED READ-ONLY |
| New authorized merchant Catalog query/adapter source | IMPLEMENTED / TESTED OFFLINE |
| Cross-shop negative tests in mocked user JWT contexts | TESTED OFFLINE |
| Actual Shop A/B user JWT, Supabase Data API/RLS hosted calls | BLOCKED — not run |
| Public Messenger/Zalo Bot→Store attestation | BLOCKED V14.8/G2.3 |
| Owner consent / merchant role authorization | BLOCKED G2.3 |
| Real Commerce order/stock write or price rewrite | NO-GO |
| Paid model 96+36 benchmark | NO-GO pending separate budget approval |
| Production release / merge | NO-GO |

**Rollback:** revert or close only Draft PR #130. Parent PR #127 and already accepted V15 synthetic Test Lab remain untouched; no live system rollback required. Current changes are GitHub source+tests+documentation only.

**Next:** `V15.0-03H.2 — Independent Authenticated Shop A/B Session RLS Proof`: use a *trusted staging-only* authenticated QA user session under a private browser, verify its own Product read succeeds, other tenant Product read fails, anon and expired JWT denied; record **redacted status and execution IDs only**, never token or user PII. This may need explicit approval for private authenticated test environment and credentials. Only afterwards authorize `V15.0-04H.2 — Read-only Hosted Catalog Adapter`. Public customer bot access remains blocked until independent Bot→Store/Owner proof is certified.

**Trial:** preserve scheduled 2026-11-22 n8n plan review; do not select or pay for a plan now.

**Final status:** Supabase table protection configuration verified; source adapter tested; **NO ACTUAL HOSTED AUTH RLS SUCCESS CLAIM**.
