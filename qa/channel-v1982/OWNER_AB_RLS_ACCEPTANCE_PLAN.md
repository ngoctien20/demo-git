# TIEN404 V19.8.2 — Owner A/B RLS Acceptance Plan (NOT YET TESTED)

## State
PROPOSED / BLOCKED. **No real Owner A/B JWT sessions have been used or tested by this PR.**
A reported SQL SELECT executed by an administrative connector does not prove user-level RLS.
All examples below refer only to a *new disposable same-tenant fixture*. Do not use real customer tables for negative-test payloads.

## Preconditions
1. Approved versioned schema migration **in disposable environment only** and a verified backup/restore checkpoint.
2. One isolated QA tenant T with two separate Stores A and B. Existing `qa-staging-shop-a-20261110` and `qa-staging-shop-b-20261110` are **different tenants** and cannot substitute.
3. Distinct authorized Owner A and Owner B authenticated via Supabase Auth; no pasted JWT, credential, e-mail, phone or actual user ID in PR, logs or chat.
4. Explicit approved Store memberships for each Owner, with negative fixture for a same-tenant member without Store membership.
5. Each Store has its own catalog row with same SKU `F01` but different QA labels/prices and independently scoped order/conversation fixtures; use only disposable fake data.
6. All migrations applied only after preview + peer review + SQL test plan; no production deployment.

## Required acceptance matrix
| ID | Actor + resource | Expected |
|---|---|---|
| A01 | Owner A reads own Store A product F01 | ALLOW |
| A02 | Owner A reads Store B product F01 | DENY |
| A03 | Owner B reads own Store B product F01 | ALLOW |
| A04 | Owner B reads Store A product F01 | DENY |
| A05 | Owner A views Store B order/status | DENY |
| A06 | Owner B views Store A order/status | DENY |
| A07 | Owner A reads Store B conversation/messages | DENY |
| A08 | Owner B reads Store A conversation/messages | DENY |
| A09 | Same tenant member without Store role reads Store A/B | DENY |
| A10 | Revoked Store A Owner membership reads former Store A | DENY |
| A11 | Expired Supabase session reads any Store | DENY |
| A12 | Anon/public key reads Store private products/orders | DENY |
| A13 | Any attempt to INSERT product using another Store ID | DENY |
| A14 | Any attempt to UPDATE product to a different Store ID | DENY |
| A15 | Cross-Store Order Item with Store A order and Store B product | FK / APP DENY |
| A16 | Cross-Store Message linked to different Store conversation | FK / APP DENY |
| A17 | Store A/B same SKU F01 read returns only own price, stock | ISOLATED |
| A18 | Supabase service_role success used as RLS proof | INVALID EVIDENCE |
| A19 | Fake `store_id` claimed by customer chat/header | DENY |
| A20 | Unbound/expired Zalo Bot installation | DENY |
| A21 | Owner as customer QA can preview own Store, no admin route | ALLOW PREVIEW ONLY |
| A22 | Owner as customer QA tries owner report/order write | DENY |
| A23 | Missing/NULL Store assignment in existing catalog | DENY READ |
| A24 | Legacy writer omits Store ID after cutover | DENY AND LOG SAFE METADATA |

For each test save: test ID, environment, expected/actual, HTTP code or sanitized query outcome, owner-scope label A/B, timestamp, exact schema commit checksum, and no customer PII.

## Authentication procedure
- Use two genuine, separately authenticated user sessions to exercise RLS.
- Require active `tenant_memberships` AND matching `store_memberships`; do not infer Store grants from `tenant_memberships` alone.
- The authenticated client must supply its own actual JWT to the tested Supabase Data API (never to ChatGPT). Do not use admin/service_role credentials when establishing user-level RLS acceptance.
- Prove both positive and negative rows are present by approved fixture IDs; a zero-row SELECT without fixture proof is not a meaningful DENY test.
- Test all writes inside disposable fixtures and restore/checkpoint between cases.

## Known blockers from audit
- Six Commerce data tables lack `store_id`, customer table included; per-Store configuration is not yet modeled.
- Current active RLS policies are tenant-wide, so simply adding a new permissive Store policy could leave tenant-wide access via OR.
- Current public product unique constraint is `(tenant_id,sku)`, not Store scoped.
- Current Bot registry in n8n is synthetic `zalo_bot_fixture`; actual Bot→Store ownership is unverified.
- Auth A/B real session/canonical proof may be difficult until login/session recovery. Do not claim VERIFIED based on previous synthetic QA.

## Promotion criteria
All A01–A24 tests must pass after disposable migrations + independent QA review. Then separately authorize a staging hosted reader. A real Zalo Send API test and Commerce order writes require further approvals.

## Rollback
Deny all hosted Store reads; turn off admission flag and stop sender/dispatcher. Keep V19.7I receipt-only webhook unchanged. Restore from tested backup if disposable migration breaks, never broaden Store RLS to tenant-wide as rollback.
