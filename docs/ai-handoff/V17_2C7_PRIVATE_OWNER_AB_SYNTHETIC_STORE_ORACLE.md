# V17.2C.7 — Private QA Actor A/B Admission × Synthetic Store Isolation Harness

Date: 2026-11-18 JST
Parent PR: #392; predecessor V17.2C.6A HEAD `351a2085808b08cda00fc86a8316e9bc197d34e8`.
Classification: **VERIFIED READ-ONLY; SOURCE-ONLY IMPLEMENTED; REAL JWT/MIGRATION NO-GO**.

## Reverified staging baseline (read-only)
- 3 existing `auth.users`; 1 Tenant with two or more active owner Auth memberships.
- 0 QA tenants with two different mapped Store keys.
- 0 existing canonical Store tables or Store-scoped Commerce columns.
- 2 existing `products` and 2 existing `orders` rows. These MUST NOT become synthetic test fixtures or be automatically assigned a new Store.
- Supabase Security Advisor still reports target privileged SQL RPC concerns. Advisor warnings are risk indicators, not proof of unauthorized access.
- V17.2C.6A operator-visible credential metadata attests header name `x-tien404-pairing` and allowed staging project domain. Value/secret match and live successful pairing NOT proven.

## Implemented, non-network test harness
- Added `qa/v172c-rpc-closure/v172c7-store-ab-synthetic-oracle.test.cjs`: 17 synthetic cases of A/B Store permissions and negative authorization checks, including unauthenticated, cross-store, cross-tenant, forged upstream store, unverified provider, invalid JWT flag, revoked session, revoked membership, missing role, unsigned identity, unknown role.
- Updated existing source-only CI to run all `qa/v172c-rpc-closure/*.test.cjs` scripts.
- These assertions use ordinary in-memory mock actors, not real Supabase JWTs. Passing the harness is **not** proof of hosted RLS enforcement or any provider integration security.
- No stores were created, no credential touched, no real identity or secret accessed and no provider sends.

## Independent private consent sequence (BLOCKED until actual approval)
1. Founder approves only disposable, isolated no-send QA creation with defined spending/rollback boundaries (not implied by a request to 'continue').
2. Two independent QA actors each consent privately to a role in a single approved disposable Tenant, each with a different Store. An existing shared tenant ownership record alone is insufficient.
3. Security reviewer independently verifies private current Supabase Auth sessions from each actor and store memberships, without exposing JWTs or identifiers in public materials.
4. Backup/restore and scoped schema migration are separately approved before executing DDL, creating users, or changing Store authority.
5. Then run real JWT A/B through real PostgREST on known synthetic rows and collect sanitized accept/deny/status evidence.

## Decision and rollback
NO-GO for canonical migration, real JWT A/B, Zalo RPC grant changes or published n8n modifications. Source-only fixtures and CI may be merged after independent review, but no production promotion. Rollback by closing PR #392 or reverting these source-only commits.
Next: V17.2C.8 — Independent A/B Consent Receipt Contract × Disposable Store Schema Review × Real JWT Negative UAT Authorization.
