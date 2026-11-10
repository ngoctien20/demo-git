# TIEN404 — Data Platform V1 — QA_REPORT

Local initial run on 2026-11-10: **11 / 11 tests passed** using `python -m pytest -q ops/data-platform/tests`.

Verified in mock-provider tests: missing credentials UNKNOWN; configured status does not claim DB connected; anonymous 401; real JWT verification call contract; allowed tenant read; other tenant 404; staff cannot read order totals; upstream 401/5xx redacted; cross-tenant provider result fail-closed; invalid UUID/limits 422; mutation POST 405; cross-origin preflight denied; HTTPS staging-only configuration; schema static RLS/read-only requirements.

**Not tested / do not mark PASS:** actual Supabase login, SQL execution, RLS behavior under real database roles, data persistence after refresh, actual Render deployment, n8n live webhook / messenger identity resolution, two-tenant isolation against real databases, actual backup/restore, payment, stock consistency, production security readiness.

GitHub CI evidence: verify after PR branch push (do not infer PASS).