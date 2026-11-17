# TIEN404 AI — RPC17.3 Trusted Operator Identity × Hosted SQLite Admission × Private Scanner Security Gate

2026-11-17 JST — IMPLEMENTED SOURCE ONLY / HOSTED NO-GO / CI PENDING

## Parent checkpoint and audit
- RPC17.2 draft PR #332 exact HEAD `a290ba59ab24bbda394625a85684180893dcdbb4` at branch creation.
- RPC17.2 Workerd local SQLite and scanner contract: CI 273/273 PASS (GitHub run #44081998024). This does **not** show Cloudflare-hosted SQLite, external scanner or real security principal.
- Preserve RPC16 (PR #313) Cloudflare Access DENY ALL, inactive 404-only Worker, R2 private and empty.
- No Cloudflare, Supabase, n8n, Meta, Zalo, live DB, billing or credential writes in RPC17.3.

## Added
1. `qa/v152-rpc173/operator-authority.mjs`: OFFLINE independent pinned Ed25519 operator assertion + separate store registry assertion, MFA freshness <=300s, fixed 120s TTL, exact tenant/store/operator/session/ownership version/issuer/audience/owner role. Rejects same signing key reused as both authorities. These are synthetic QA signatures, NOT verification of real Supabase JWT or Cloudflare Access identity.
2. `qa/v152-rpc173/hosted-change-gate.mjs`: operator/owner/reviewer/finance/hosted DO/scanner/JWT evidence matrix; denies public routes, previews, existing RPC16 Worker replacement and all real uploads. Even all synthetic checkboxes true MUST keep can_deploy=false.
3. Offline Node tests + inherited RPC13–RPC17.2 source regressions, with GitHub CI no deploy. The existing RPC17.2 local Workerd SQLite runtime evidence is inherited by checkpoint, not rerun in this source-only workflow.

## Security risks and blockers
- No authenticated real owner/operator, fresh independent MFA, trusted Store A/B real JWT and canonical Store ownership record.
- No hosted SQLite DO or independently assessed atomic replay persistence; no real scanner/CDR; no files received.
- No independent authorized Finance/Operator/Security approvals or per-resource budget limits.
- Treat untrusted request headers, browser JWT payload, user_metadata or caller-supplied store_id as untrusted; never authorize from them.
- Source-only fixtures cannot prove independent human authority. Signed test assertions cannot satisfy hosted security gates.
- RPC10 separate workflow failure remains outside this branch and must not be misreported as fixed.

## Rollback/approval
- Close this Draft branch/PR only; no hosted rollback because no cloud resources created.
- Separate owner/security/finance authorization, unique QA identities and independent hosted verifier needed before any new resource creation, Access Allow, R2 writing or scanner network integration.
- Do not merge stacked drafts or change production.

CHECKPOINT: RPC173_SOURCE_ONLY · DUAL_PINNED_AUTHORITY_NEGATIVE_QA · HOSTED_NO_GO · RPC172_LOCAL_CI_273_273
