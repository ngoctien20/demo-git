# TIEN404 — Data Platform V1 — CHANGELOG

2026-11-10: Added independent Supabase/PostgreSQL SaaS staging schema, a read-only tenant-aware FastAPI API, strict staging runtime gate, mock-provider security regressions, integration contract with existing Super Admin PR #2, and staging GitHub Actions workflow. No real credentials, no n8n edits, no production data, no deployment.
## 2026-11-10 — Actual staging infrastructure provisioned

- Supabase project `tien404-staging` (Singapore) created at $0/month quoted and initial RLS migration applied; actual tables, grants and role tests inspected.
- Render Free `tien404-data-staging` (Singapore) created with autoDeploy disabled and server-side publishable key; initial deployment is LIVE in Render and Uvicorn startup confirmed.
- Added staging public smoke workflow; full remote endpoints/Auth acceptance pending.
- No production workflow, Supabase Auth user, customer data or payment mutated.

## 2026-11-11 00:38 JST · V6
Đối chiếu hồ sơ staging, không đổi migration hoặc runtime. [Bằng chứng](LIVE_INTEGRATION_QA_20261110.md).
