# TIEN404 V18.0-P0Q — Reuse existing hosted Data Gateway for future private Auth verifier

2026-11-18 JST. VERIFIED SOURCE AND DEPLOY METADATA / SOURCE-ONLY ANONYMOUS SECURITY CHECK / PRIVATE VERIFIER NOT DEPLOYED.

## Existing deployed service — independently examined

- Render tien404-data-staging service ID srv-dbphtas9v7es73bursrg is an existing FastAPI web_service; autoDeploy OFF, branch ops/tenant-data-platform-v1-staging-20261110.
- LIVE deploy dep-dbqj9plg1s2s73egr30g runs commit ab940a95dae8afdff426bc6ac71693833d5348ce; exact deployed main.py SHA blob a7a11abeffb378b3f9952005ffdd489c54df1c13.
- Deployed main.py lines 122-134 validate Bearer format then GET /auth/v1/user using Supabase Auth. Lines 136-148 read tenant_memberships for current subject through RLS. Products/orders handlers at lines 197-220 are tenant-only.
- The current backend has no independent getClaims cryptographic session_id-to-auth.sessions verification, revocation correlation, real A/B owner admission or canonical Store membership enforcement. It is NOT an acceptable Store authorization decision point yet.
- Hosted service permits 0.0.0.0/0 network access; exact-origin FastAPI CORS, no-store security headers, and disabled API docs are NOT substitutes for a protected Access gate. Never publish a credential-taking verifier here without additional private access control and approval.
- The health endpoint intentionally reports production_readiness NOT_APPROVED and does NOT prove an end-to-end Supabase connection.

## Live anonymous negative smoke — safe, no credentials

- The new qa/v180-p0q/live-anonymous-gateway-qa.mjs uses only public GET /health and no-bearer GET /api/v1/tenants plus synthetic all-zero-UUID product/order routes.
- It demands 401 AUTH_REQUIRED for no-bearer routes; must not access actual users, customers, orders, JWT, cookies, provider events or use any write method. The CI report is only anonymous denial evidence; it CANNOT prove two signed real user sessions, token revocation, or Store A/B isolation.

## Proposed reuse design — NO HOSTED CHANGE

Re-use the existing FastAPI infrastructure and its trusted Supabase /auth/v1/user flow for real identity admission only after independent QA owner consent and a private Access gate. A future separately reviewed module must verify actual signed getClaims/JWT issuer, audience, expiry, subject, session_id and current server auth.sessions correlation/revocation, using minimal server-side privileged secrets stored only in managed secret storage. Do not expose service_role to browsers, issue logs, GitHub, n8n or chat. Do not forward a bearer token to publicly accessible receipts or a client-side HMAC. Add replay-safe, short-lived server attestations with explicit no-send scope, private audit and no Store grant semantics. A new public endpoint is NOT approved.

Further gates: actual owner A/B P0O read-only result (not yet received), independently verified two owner sessions in same tenant, separately consented protected verifier admission, M0 backup/restore before hosted Store RLS migration, trusted canonical stores and owner mappings and 31 real signed JWT negative Store A/B UATs. All remain blocked today. Source-only/unauthenticated test requires no runtime rollback. No provider messages or production changes.
