# TIEN404 CONTROL HUB — CHANGELOG

## 2026-11-10T09:26:33Z — Audit/monitoring staging
- Audited GitHub Actions and n8n API read-only.
- Identified and recorded Published/Draft version drift and revenue report manual failure.
- Developed standalone HTTPS/GitHub status probe in `tools/probe_public.py` with strict allowed hosts and no writes.
- Added six unit tests for status classification and correct GitHub branch filtering.
- Added GitHub Actions read-only monitor workflow on staging branch; production Control Hub app unchanged.
- No tokens, credentials, Google Sheets orders or production databases modified.

## 2026-11-10 09:28 UTC — Verified external probe
- Control Hub: HTTP 401 AUTH_REQUIRED. Website: HTTP 200. Github Actions API reachable.
- GitHub Actions run `42791015031`: 6/6 unit tests successful; JSON/Markdown evidence stored as artifact `13750119259`.
- Draft pull request: https://github.com/ngoctien20/demo-git/pull/1 (approval required; no production merge).

## 2026-11-10 — V2 read-only monitor hardening (staging PR only)
- Corrected 302-to-login classification by consuming HTTP `Location` instead of treating every redirect as a possible unrelated URL.
- Scoped GitHub bearer tokens to the explicit repository API, forbade userinfo/custom ports and all redirect-following.
- Added 429/5xx error states, measured staleness and deterministic newest GitHub Actions selection.
- Added last successful Pages deployment + matching `gh-pages` commit calculation; these do not imply Control Hub functional readiness.
- Added tests for malformed JSON, missing metrics, staleness, auth redirects, secret isolation and source-commit drift.
- Added `CONTROL_HUB_INTEGRATION_CONTRACT.md` and `AUTH_TEST_MATRIX.md` for future safe integration into the **existing** Sites project.
- Not deployed to Sites or merged to production. No n8n credentials/workflows modified.