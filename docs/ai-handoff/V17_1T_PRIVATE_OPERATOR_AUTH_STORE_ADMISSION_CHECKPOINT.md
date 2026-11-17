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
- New candidate test suite includes 107 inherited V17.1S tests plus 43 new source-only cryptographic four-party approval tests: 150 expected. Older inherited suites: 855 expected. Combined candidate 1005, subject to independent CI.
- Disposable PostgreSQL17 RLS job uses only temporary synthetic records and rollback.
- Hosted independent owner, provider and Commerce admission is intentionally blocked and CI marks it NO-GO.
- Rollback: close V17.1T Draft PR. The parent and published workflows remain intact. No Supabase writes, billing, credential or merchant messages were performed by this work.

Official Auth documentation: https://supabase.com/docs/reference/javascript/auth-getclaims and https://supabase.com/docs/guides/auth/sessions

## Source security hardening added during CI review

- GitHub CI first encountered a real concurrency acceptance flaw: the two owner JWT receipts were consumed after asynchronous signer lookups. The code was changed to consume both JWT capabilities **before the first awaited signer registry call**. This closes duplicate concurrent approval attempts, rather than weakening the concurrency assertion. The revised 147/147 source tests passed that check.
- Approval intent commit SHA is now checked against a **trusted private operator configuration value**; a syntactically valid but different SHA is rejected even if four Ed25519 QA signers sign it. Missing pin fails closed.
- On the final authority recheck, both merchant owner consent signer bindings must still match the original Auth subject, Store and Tenant; public signer key rotation or reassignment also denies admission.
- Three additional independent negative tests cover incorrect signed commit, late owner signer Store reassignment and absent trusted commit pin; total **150 V17.1T source tests plus 855 inherited = 1005 expected** at final CI.
- These tests are still entirely SOURCE-ONLY, with generated QA keys and fake session/owner fixtures. No private real owner keys or sessions have been provided.

CI exact run and results must be appended after verified execution. Hosted real JWT/provider/Commerce admission remains deliberately NO-GO.


## Verified independent CI and release receipt — 2026-11-17 JST

**Tested source commit:** `cd6c13ab3784424001ebf51fa4a3ae78adc29003`.
**GitHub Actions:** https://github.com/ngoctien20/demo-git/actions/runs/44074256721.

- **Source job `134008081926` SUCCESS:** `150/150` new V17.1T cryptographic JWT/Ed25519/four-party authorization tests, plus `855/855` inherited V17.1P–V17.1D regressions, **1005/1005 PASS**. Static contract check for no real network/secrets/DB/I/O and hosted admission HOSTED_NO_GO PASS.
- **Independent disposable PG17 `134008082479` SUCCESS:** same-Tenant synthetic Store A/B RLS test, temp data transaction ROLLBACK and cleanup. Console prints `DISPOSABLE_SAME_TENANT_STORE_A_B_RLS_PASS` with explicit scope `NO_REAL_JWT_NO_COMMERCE_TABLES`.
- **Hosted real private operator and owner JWT / Meta/Zalo release `134008406762`: FAILURE BY DESIGN**. No genuine two-owner same-Tenant Auth JWT evidence, owner/operator signers or native QA provider signed no-send events. Overall workflow marked failure intentionally as a security release gate.
- CI initial flaw: duplicate simultaneous requests could both observe JWT receipt unused before asynchronous approver registry lookup; the code was corrected to **consume owner receipts before the first await**. A source gate metadata assertion was reconciled against the actual plan name, without altering access controls. Further source hardening pinned operator approval to a trusted commit SHA and ensured owner consent signer Store/Tenant binding remained unchanged at commit; 3 additional adversarial tests passed.
- **Real hosted UAT was NOT run.** Current live mapping does not yet provide two eligible owners in a same Tenant; no operator/merchant identity or provider credential was imported, accessed or modified. Source test signatures use ephemeral QA keys only.
- Owner-sensitive changes remain blocked. Only this GitHub Draft PR may be closed for rollback; there is no production/n8n/Supabase change to restore.

**Disposition:** IMPLEMENTED source-only four-party approval gate / TESTED 1005 source tests and disposable PG17 / REAL OPERATOR+OWNER UAT BLOCKED / PRODUCTION HOSTED NO-GO.

The checkpoint-only documentation commit will create a new SHA; final-HEAD CI must be checked again before final signoff.
