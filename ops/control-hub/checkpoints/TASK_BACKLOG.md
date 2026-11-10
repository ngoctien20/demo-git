# TIEN404 CONTROL HUB — TASK_BACKLOG

Severity: P0 data loss/money/security, P1 critical business flow, P2 UX/performance, P3 minor. `Unknown` is not an observed bug.

| ID | Severity | Task | Evidence / why | Done when |
|---|---|---|---|---|
| CH-P1-01 | P1 | Restore authenticated access to existing Control Hub source and deployment | Source not mounted via Sites app; no authorized 401/browser verification | Site repo/workspace, route map, auth test, database schema and current build are independently inspected |
| CH-P1-02 | P1 | Implement secure server-side read-only provider adapters; show Unknown/Connection Error on failure | Currently no verified source to connect dashboard to GitHub/n8n | Provider response includes status, timestamp, source, error, no secrets in frontend; integration tested |
| CH-P1-03 | P1 | Audit Control Hub auth, RBAC, persistence and audit logs | Can't read or log in to existing Control Hub in this session | Authorized accounts/roles verified and refresh/session tests pass; CSRF/XSS checks have evidence |
| CH-P1-04 | P1 | Investigate Revenue Report fail-closed manual execution error | Manual execution returned Invalid paid total at Orders row 2 | Reproduced with synthetic data; no production orders changed; fix reviewed and tests pass before publish |
| CH-P1-05 | P1 | Verify recoverable Site/D1 and n8n backups | No verified Control Hub backup/restore artifact in this runtime | Private, checksum-verified export and restore drill on staging |
| CH-P2-01 | P2 | Show Published vs Draft version drift for AI SALES workflows | Confirmed four workflows have version mismatch | UI warning, version comparison link, publication approval action |
| CH-P2-02 | P2 | Observability and read-only status snapshots | Public URL can be probed from GH Actions, other provider APIs require private proxy | Read-only schedule produces evidence; Health states honest and freshness rules explicit |
| CH-P2-03 | P2 | Independent full responsive, accessibility and console QA for Control Hub | No authenticated browser access | All routes at 320/390/768/1440px, keyboard, ARIA, empty/error states tested |
| CH-P2-04 | P2 | Approval-gated development center with PRs and rollback | No verified executor backend | A real PR/test/deploy integration with audit log, rollback validation and RBAC |
| CH-P3-01 | P3 | Searchable, filterable workflow table and motion polish | Desired UX improvements | UX tested using production-shaped data with source timestamps and Unknown states |

No P0 has been confirmed in this audit; unidentified P0 risk is possible pending security review. Do not mark UNKNOWN checks as PASS.