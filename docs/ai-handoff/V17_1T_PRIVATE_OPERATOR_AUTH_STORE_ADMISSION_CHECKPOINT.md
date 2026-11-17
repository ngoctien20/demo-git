# TIEN404 AI V17.1T — Private Operator Authorization / Two-Store Auth Admission

Date: 2026-11-17 JST. Parent Draft PR #311, HEAD 4c29b6b716e252db74340da5a38f2731be38db26.
Lifecycle: SOURCE-ONLY candidate; real independent owner authorization and hosted UAT BLOCKED.

## Verified staging state
- Supabase staging: two owner-linked QA Stores belong to two different Tenants; zero qualifying pairs of two owners/two Stores under the SAME Tenant. Zero same-Tenant active two-user Auth session/member pairs. Core Products/Orders/Customers do not have a direct Store-level RLS predicate or store_id column.
- Messenger V17.17 active/published (32 nodes, all four V17.15 nodes preserved) and Zalo V17.19 active/published (12 nodes). V17.1P Code-only QA remains inactive. These have not been edited by V17.1T.
- Legacy anonymous-executable privileged RPC qa_shop_b_zalo_claim remains a separate P0 review candidate; no exploit demonstrated and no RPC invocation.
- No real Auth tokens, owner IDs, provider secrets or customer records were fetched or copied.

## What is implemented in child Draft PR
The source-only module qa/v171t-private-uat/private-admission.cjs extends the V17.1S verifier with planOperatorAuthorizedTwoStoreAuth. It requires two independently verified JWT owner receipts (distinct users and sessions; different Stores in same Tenant), and four cryptographically signed approvals bound to an exact private staging scope: operator, independent security reviewer, Store A owner and Store B owner.

The verifier uses server-trusted pinned public signer keys, not a key supplied in the client request. It requires four different registered signing identities, current owner/sub matching, short expiry, no-send/no-write/no-billing/no-credential-change flags and a one-use private approval nonce. Immediately before issuing the test plan it rechecks owner sessions, ownership and the signer registry. A successfully tested request returns only a no-send, no-write, no-credential, no-Commerce-read plan with HOSTED_NO_GO. No real accounts, membership, credential, webhook or reader are provisioned.

The module contains no HTTP endpoint, external database or provider send call. Private signing keys for tests are generated at runtime and never stored in GitHub.

## What remains blocked
1. Separate owner/operator approval to enroll real independent QA Auth users in different Stores of SAME Tenant; do not reassign production merchants or alter existing subscriptions.
2. Protected private operator/reviewer and owner signer enrollment. Do not accept approved=true or an untrusted public key.
3. Independent real session verification against current Supabase Auth state and scoped owner permissions, without putting tokens or session secrets in chat, GitHub or n8n logs.
4. Private Meta Page and Zalo OA installation consent with managed secrets and native raw signed no-send callback verification.
5. Least-privilege Store-level RLS and Commerce Reader QA using approved disposable records; verify A->A/A->B and B->B/B->A with actual identities, not SET ROLE simulation.
6. Independent security QA receipt and separate release/cost approval before any hosted deployment.

## QA, rollback and release decision
- New candidate test suite includes 107 inherited V17.1S tests plus 40 new source-only cryptographic four-party approval tests: 147 expected. Older inherited suites: 855 expected. Combined candidate 1002, subject to independent CI.
- Disposable PostgreSQL17 RLS job uses only temporary synthetic records and rollback.
- Hosted independent owner, provider and Commerce admission is intentionally blocked and CI marks it NO-GO.
- Rollback: close V17.1T Draft PR. The parent and published workflows remain intact. No Supabase writes, billing, credential or merchant messages were performed by this work.

Official Auth documentation: https://supabase.com/docs/reference/javascript/auth-getclaims and https://supabase.com/docs/guides/auth/sessions
