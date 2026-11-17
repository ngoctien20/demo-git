# TIEN404 AI — RPC17.4 Verified Private Operator × Real Store A/B Identity × Hosted No-Send Canary Readiness

2026-11-17 JST · SOURCE-ONLY · CI 357/357 VERIFIED · STAGING READ-ONLY AUDIT · HOSTED NO-GO

## Parent checkpoint
- Based exactly on RPC17.3 Draft PR #335 HEAD `1e9e5dbc071eb888006699a27b0635ec7b95f488`.
- PR #332 RPC17.2 local Workerd/SQLite passed 273/273; PR #335 RPC17.3 source-only passed 317/317; neither is independently hosted-accepted.
- Preserve Cloudflare RPC16 Access DENY ALL, private empty R2, disabled workers.dev and preview URLs. No deployment or new costs in RPC17.4.

## Real staging facts (read-only Supabase)
- Project `ifxlvrhyjhbzbrkdsida` (tien404-staging) ACTIVE_HEALTHY, PostgreSQL 17.
- Public `tenants` and `tenant_memberships` exist with RLS enabled.
- No public `stores` or `store_memberships` found. Cross-schema inspection found only `tien404_v175_qa.order_ownership` among store/merchant/ownership-named tables; this does not establish canonical Store A/B authorization.
- Counts ONLY (no identity disclosure): 3 auth.users, 2 users with session records, 3 active tenant memberships, 1 tenant with >=2 active member users. These counts are not real fresh JWTs, verified logged-in identities, same-Tenant Store A/B membership evidence, or successful RLS UAT.
- No real private owner/operator signed proof admitted to this workflow. Do not extract or log users' tokens.

## Source implementation
- `qa/v152-rpc174/real-store-ab-readiness.mjs`: hard no-send/NO-GO gate listing 20 independent requirements, including trusted operator proof, actual JWT A and B verified by issuer, separately live sessions, same-tenant member proof, distinct Store A/B scoped authority, canonical store resolver, negative RLS proof, hosted durable replay, isolated scanner/CDR and rollback.
- Rejects same user, store, session, public routes, allow policies, real uploads, outbound send, string-true fake approvals or raw tokens/metadata in evidence.
- No test claims to authenticate real Supabase tokens; synthetic field checks are never a release authorization, even with all fields true.
- Redacted QA trace only permits safe strings and whitelisted keys. Never save tokens, customer PII, raw scanner content or Merchant documents.
- GitHub CI includes offline negative tests, RPC13-RPC17.3 source regressions, no deployment and no R2 writes.

## GitHub Actions verification
- RPC17.4 GitHub Actions run #44084806687 at commit `6005436fedab18beb466e306a40dbc430c9024f3` **SUCCESS**, 357/357 PASS across 11 source-only suites: RPC17.4 40, RPC17.3 51, RPC17.2 scanner + independent gate 32, RPC17.1 29, RPC17 26, RPC16 74, RPC15 45, RPC14 19, RPC13 41.
- The separate unrelated RPC10 workflow still fails and is not counted as passed. All real hosted Store A/B and human authorization gates remain BLOCKED.

## Admission and recovery
- Do not create Store tables, mutate membership, use service_role, run hosted private scanner, open Cloudflare Access, create paid resources, or upload Merchant evidence without separately verified owner/operator/finance/security approvals.
- Independent real A/B UAT must be undertaken via controlled external authenticated browser sessions on disposable Store accounts, with real JWT verification and safe store-scoped RLS read-only negative cases. First define and independently approve the canonical Store schema and restore path, then demonstrate both A and B distinct access; test third-party cross-tenant isolation.
- Rollback: close source-only Draft PR. RPC16 hosted unchanged.
- Existing unrelated RPC10 GitHub workflow failure must be audited separately.

CHECKPOINT: RPC174_PR338 · CI_357_357_PASS · SUPABASE_SCHEMA_VERIFIED_TENANT_ONLY · STORE_AB_REAL_JWT_NO_GO · CLOUD_HOSTED_NO_GO
