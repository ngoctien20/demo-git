# TIEN404 AI V4 — NEXT_ACTIONS (staged, never rerun successful mutations blindly)

1. Confirm existing Sites Control Hub source/runtime via ChatGPT Work and compare deployed build, 401 authorization policy, D1 migrations and session layers. No Super Admin production code has been changed here. **Required** before choosing the final backend architecture.
2. Review Draft PR #1 (read-only monitor, already exists) and stacked Draft PR #2 (staging-only Super Admin domain). Do not merge to main or gh-pages until the owner approves repository schedules, backend architecture, costs and release gate.
3. Re-run the staged Python tests and inspect exact GitHub Actions commit status, not an earlier successful run. Run filesystem-secret scan and ensure no test DB/key is committed.
4. On an isolated Sites staging instance, migrate the *policies* (not SQLite file) into existing D1 schema with explicit migration/rollback. Preserve existing login sessions and old records until reconciled; compare sample data across versions. Take private D1 and Source backup first.
5. Implement production identity: OAuth/passkey or audited MFA enrollment and recovery, external immutable audit export, session device management, shared login rate limiting, account notifications and server permission scopes.
6. Select a real payment provider and pricing/grace rules with approval; implement its exact signature + idempotency and compensation/refund. Disable any synthetic payment adapter in production.
7. Build one channel adapter at a time, beginning with existing Messenger test environment, and verify official permissions. Never reuse AI_SALES_DEMO credentials or Orders/Products in TIEN404 Commerce.
8. Connect Knowledge Center to approved-version public AI only after hallucination and prompt-injection evaluation. Maintain a manual fallback to human support.
9. A separate **staging-only read-only Super Admin UI** now exists in `app/ui`, served by the isolated FastAPI app. Before adding any Super Admin pages **inside existing Control Hub**, inspect its authorized Sites source and auth; port existing views/policies rather than deploying a second privileged production console. No mock 'Auto Fix', client-side token or invented KPI.
10. Run independent E2E/permission/mobile/backup restore tests on staging, categorize P0/P1, obtain human approval, then stage canary launch and rollback. Publish only after all release gates pass.

Never claim 100% completion from a green unit test count. Checkpoint on the same branch and in user Library after every task group.

11. The local SQLite staging backup/restore unit test passes; still take a **separate private Sites/D1 backup** and try restoration on isolated production-shaped staging. Never upload private SQLite backup to public GitHub.

12. Test new `/admin` view via HTTPS staging in actual mobile/desktop browsers; verify keyboard, accessibility, MFA, CSP, session expiration, role-denied views and no cross-tenant data. CI 42819808814 passed local isolated tests, not end-to-end hosting.
