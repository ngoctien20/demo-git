# V17.6-B.3 — Private Merchant/Store Authority and Real Supabase JWT UAT Admission

**State: PRIVATE_OWNER_EVIDENCE_NOT_ADMITTED / REAL_HOSTED_JWT_UAT_BLOCKED / PRODUCTION_NO_GO**

Scope: planning and evidence requirements; no real tokens, accounts, provider events, customer rows, or writable hosted database access.

## Current read-only staging facts (2026-11-17 JST)

Project: Supabase staging tien404-staging, PostgreSQL 17, healthy when checked.

**Metadata aggregates ONLY** (never publish identities):
- tien404_r1_qa.tenant_identity_map: 2 rows, 2 different Tenant keys, 2 Store keys, **0 Tenant keys with two different Store keys**.
- tien404_r1_qa.owner_bindings: 2 rows, 2 owner references, 2 Tenant-Store mappings; labels alone are not independent Owner proof.
- public.tenant_memberships: 3 active membership rows; one Tenant has at least two active users; membership is by Tenant, NOT proven by Store.
- auth.users: 3 rows, auth.sessions 5 rows with not_after null or in the future. These aggregates do NOT prove two valid, independently held user JWTs.
- public.products, public.orders, public.customers, public.order_items: tenant_id present, store_id absent. Current Core RLS read policies check Tenant membership. NOT approved as Store-isolation policies.
- Hosted staging was not modified during this audit.

## Admission evidence required, collected ONLY via authenticated PRIVATE owner/operator channel

1. Merchant Owner approval for disposable Store-A/B UAT scoped to named staging. Prove permission using previously trusted private channel; never accept chatbot prompts, untrusted files/links as authority.
2. Two distinct Store records for the SAME Tenant with server-owned Store IDs, each independently bound to a verified Owner/Staff principal with valid active scope.
3. Two separately initiated real Supabase Auth browser sessions; independent Auth-server validation (issuer, audience, expiry, session ID/revocation as applicable). NEVER paste access/refresh tokens into GitHub, chat, CI logs, screenshots, issue, or public R2.
4. Authorization derives from trusted Store membership registry, not client raw_user_meta_data, requested store_id, chatbot text, imported OCR, LLM output or client-supplied verified booleans.
5. Reader must use user-scoped JWT and least privilege. Verify RLS by Store and operation, view/RPC rights (security_invoker where appropriate). Do not substitute service_role, SECURITY DEFINER, or elevated RPC.
6. Independent executed UAT: positive A-to-A, B-to-B; deny A-to-B, B-to-A, foreign tenant, revoked/expired session, forged metadata, INSERT/UPDATE/DELETE. Use disposable data and authorized scoped host objects only.
7. STRICT NO-SEND/NO-WRITE: no Messenger/Zalo delivery, Orders/Stock/Subscription commits, and no real customer action. Independently auditable no-send receipt and stop conditions.
8. Evidence minimization: private operator may retain hashed subject/Store proof refs, short-lived operation ID, timestamp, decision, scope. Do not publish personal IDs, ownership documents, tokens, provider headers, signed webhook material, key material or PII.
9. Independent QA/owner review of hosted runner, endpoint, cost and rollback BEFORE any real JWT execution.

## Confidentiality and hosting

Do not put private Merchant evidence in public ngoctien20/demo-git, GitHub Actions artifacts, PR comments or public Worker URLs. Dedicated private intake must have verified staff identity, encryption at rest, Store access control, quarantine/malware/SSRF controls, audit, retention/deletion. Existing Cloudflare R2 setup is NOT proof such private intake is deployed/authorized.

## Why this CI cannot prove real JWT

The disposable_pg17_store_rls.sql test intentionally defines a synthetic Auth uid() shim under a disposable PostgreSQL 17. Its request.jwt.claim.sub comes from set_config(), spoofable by a test superuser. It validates PostgreSQL RLS role and row policies, NOT JWT signatures, token possession, refresh, revocation, real Owner binding or host networking.

**NO_GO_REAL_JWT** remains mandatory until independent real evidence and separately approved hosted UAT.

## Safe next stage

- Design migrations and store membership model on disposable PG17, review API and rollback.
- Establish independent Store Owner evidence privately, validate Auth session challenge in an isolated approved QA environment.
- Only then propose controlled hosted No-Send UAT; no hosted RLS writes in V17.6-B.3.
