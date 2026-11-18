# TIEN404 AI V17.2C.25 — HTTPS Request Bounds × Real Supabase Auth Schema Metadata × Hosted UAT NO-GO

Date 2026-11-18 JST. Parent Draft PR #392. Previous V17.2C.24 checkpoint bf1cec4efe219088b71a86fdd4955da4bd7541e2.

## Verified starting state
- PR #392 open DRAFT, no merge/publish.
- V17.2C.24 final checkpoint CI: protected source 44228333072, source privilege contract 44228333168, ephemeral PostgreSQL 44228333268 — all SUCCESS.
- Supabase tien404-staging (ifxlvrhyjhbzbrkdsida) ACTIVE_HEALTHY Postgres 17.11; no development branches. Neither this staging database nor BIO is an approved disposable UAT target.
- No independent QA owner A/B private signed consent, real Auth session evidence, independent reviewer sign-off, approved disposable project/branch cost or restore rehearsal.

## Actual source security changes (Draft only)
- qa/v172c-rpc-closure/v172c24-private-consent-https-handler.cjs:
  replaced unbounded request.text() with readBoundedBody streaming chunks under strict 1024-byte limit. Rejects chunked bodies without Content-Length that exceed limit; fails closed on malformed UTF-8. No bearer/JWT stored or logged.
- qa/v172c-rpc-closure/v172c24-private-consent-https-handler.test.cjs:
  added negative streaming test (no Content-Length with 1600-byte body) and invalid UTF-8 body. Both must deny before backend call.
- qa/v172c-rpc-closure/v172c23-private-active-session-reader.cjs:
  tightened existing private read-only active-session SQL to check PostgreSQL auth.sessions not_after IS NULL OR not_after > NOW() in addition to parameterized id/user_id.
- qa/v172c-rpc-closure/v172c23-private-active-session-reader.test.cjs:
  added SQL contract assertion for not_after expiry predicate.
- Verified live Supabase Auth schema metadata with read-only information_schema query (no auth.sessions rows, JWT, credentials or customer information accessed): auth.sessions has uuid id/user_id, timestamptz not_after, created_at and updated_at. This grounds the query against an actual connected Supabase database, but live auth execution has NOT been tested.

## QA evidence at code SHA 6bebb5933c9c918cf53fd39ef359d4fc91b40311
- GitHub Source Security Contract run 44229740530 — SUCCESS.
- GitHub Protected Consent Backend source/HTTP tests run 44229740543 — SUCCESS.
- GitHub ephemeral PostgreSQL 17 RLS / atomic receipt / atomic A/B pair tests run 44229740531 — SUCCESS, including all three database drill steps.

## Hosted UAT admission gate
- HTTPS request handler is still candidate source only, NOT deployed. TLS, proxy identity, rate limiter, CSRF/Access and private credentials must be independently reviewed and verified in a real protected staging runtime.
- The live Auth adapter remains unconnected to protected real JWT session validation. PostgreSQL metadata is read-only and cannot be used as a real signed session acceptance.
- Real owner A and B must authenticate independently, explicitly consent to scoped read-only/no-send QA, reviewer must be independent and server must authoritatively bind Store identities. No such evidence exists yet.
- No verified organization-specific price quote, budget cap, retention window, recovery rehearsal or approval for disposable Supabase creation. Do not create paid branch or modify real staging.
- No workflow publication, actual Messenger/Zalo send, order write, customer change, credential change or production release.

## Decision
SOURCE SECURITY QA PASS / EPHEMERAL POSTGRES PASS.
REAL HTTPS HOSTED UAT + AUTH A/B + JWT/POSTGREST NO-GO.
Rollback by reverting changes in Draft PR #392 or closing the Draft PR. No live database changes to roll back.

Next gated action: obtain authorized separate disposable environment cost/recovery decision and protected reviewer/owner consent before deploying HTTPS/Auth intake in isolation. Prefer authentic security evidence over more synthetic test versions.
