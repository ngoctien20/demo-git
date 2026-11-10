# TIEN404 CONTROL HUB — CHANGELOG

## 2026-11-10T09:26:33Z — Audit/monitoring staging
- Audited GitHub Actions and n8n API read-only.
- Identified and recorded Published/Draft version drift and revenue report manual failure.
- Developed standalone HTTPS/GitHub status probe in `tools/probe_public.py` with strict allowed hosts and no writes.
- Added six unit tests for status classification and correct GitHub branch filtering.
- Added GitHub Actions read-only monitor workflow on staging branch; production Control Hub app unchanged.
- No tokens, credentials, Google Sheets orders or production databases modified.