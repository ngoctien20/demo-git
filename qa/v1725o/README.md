# TIEN404 V17.25O — Trusted Store Selection × Legacy Router NO-HOST

**Classification:** SOURCE-ONLY / SYNTHETIC ASGI QA / M0 NOT APPROVED / HOSTED NO-GO.

- Extends Draft PR #406, does not edit the P0D PostgreSQL fixture, PR #385,
  production Render application, public Orders RLS, n8n, Meta/Zalo channel ingress.
- For synthetic Messenger/Zalo/Web ingress, a *server-injected* port must first
  verify provider assertion or an equivalent trusted web session, freshness and
  replay, and then resolve the installation in a server-owned registry. The
  resolved tenant/store must match the requested URL. Customer identities are
  **not** cross-channel linked by resolving the installation.
- `SelectedStoreCandidate` does not authorize any real Store, Orders or sends.
  Its positive test is only **shape consistency using a synthetic backend port**.
  Never expose trusted ports or caller-supplied verification flags as HTTP input.
- `install_inactive_store_guard()` is only for an isolated FastAPI ASGI instance:
  legacy tenant-wide Orders is intercepted with 503 for reads, 405 for writes;
  the new Store-scoped Orders path always returns 503. This does **not** modify
  the real Render route. CI creates a synthetic legacy route behind the guard,
  proves it is not entered, and verifies unrelated `/health` is unchanged.

## M0 Recovery admission (reuse existing evidence, not new registry)

Existing source-only checkpoint [Draft PR #398](https://github.com/ngoctien20/demo-git/pull/398)
owns `qa/v180-p0d/origin-m0-auth-readiness.mjs` and its fail-closed M0
evaluation. **Do not implement a competing M0 approval service here.**

**Current blocking evidence:** The owner deferred a real local backup on
17 Nov 2026. No current independent isolated restore/readback has been verified.
The Supabase staging organization is Free; do not assume managed backups.
Prior local application-only compare is not Auth or store scope evidence.

Before proposing a **separately approved** hosted migration, require:
1. Current, owner-authorized backup inventory and scope covering DB/schema,
   users/roles/permissions and Auth as applicable — **no credentials** in logs.
2. Immutable checksums (backup and independently restored readback), secure
   private storage and provenance; documented encryption and authorized owner.
3. Restore performed in a separately approved, isolated target, non-production
   account/role, with actual readback of required tables and Auth coverage.
4. Independently signed reviewer acceptance, timestamp, RPO/RTO, rollback
   operator and expiry/teardown instructions.
5. Product-specific plan/usage/cost validation before creating paid resources.
6. Separate approvals for Access S1, Store schema/RLS, signed real JWT Owner A/B
   sessions, provider traffic and production.

**Present gate:** M0 `NO_GO`, hosted Store read/write `false`, real JWT UAT
`0/31 NOT_RUN`, production `NO_GO`.

**Rollback:** Close this Draft PR or revert its source-only branch. Its CI
environment is ephemeral. No hosted rollback has been authorized or needed.
