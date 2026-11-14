# TIEN404 AI — Work V12.0 R1 / Owner Pairing Two-Phase V3
**Checkpoint:** 14/11/2026 JST — staging only, experimental.  
**PR:** [#34](https://github.com/ngoctien20/demo-git/pull/34) on `work/v12-r1-shop-owned`, NOT MERGED.  
**Product direction:** Shop-Owned AI Sales Bot, sandbox order and same-shop Owner notification.  
**No production deployment, no real Zalo sends, no Messenger changes, no real Orders writes.**

## VERIFIED — existing state
- Supabase staging ref `ifxlvrhyjhbzbrkdsida`, private schema `tien404_r1_qa`.
- Two synthetic QA bots, two paired QA owners, three QA sandbox orders and three outbox events `HELD`; zero dispatched.
- `public.orders` remains at two rows; original Commerce tables were not modified.
- All tables in `tien404_r1_qa` have RLS enabled; schema has NO direct `anon` or `authenticated` USAGE grant; new confirm function has no authenticated EXECUTE grant.
- Zalo Cloudflare Worker `tien404-zalo-outbound-v1-staging`: `ZALO_SEND_ENABLED=false`; D1 TEST09 remains claim=1, quota=1.
- n8n Zalo Webhook and Messenger live both remain Active at the original published versions (no writes performed).
- Existing read-only Edge Function `tien404-r1-owner-preflight` remains v1, `verify_jwt=true`. Its real HTTP missing/forged-JWT negative tests previously passed 2/2. A successful signed-user-JWT positive test is NOT yet complete.

## Found: insufficient proof of pairing issuer
The previous private QA function `pair_owner_authorized_qa` validated only *membership in the store*. It did not prove that the person presenting the code was the exact Owner who requested it. Even a JWT-passing direct pair function is inappropriate for Bot webhook messages because the Bot sender does not carry a Supabase Owner JWT.

## IMPLEMENTED — private schema V2/V3
1. Added nullable `owner_pairing_challenges.requester_user_id` (foreign key to `auth.users`) for new issuer-bound QA challenges. Existing historical fixture rows remain intact.
2. Created private `pair_owner_authorized_v2_qa` (issuer-bound only). This is a transitional QA function, **not** a production Bot webhook entry point.
3. Introduced two-step handshake:
   - `owner_pairing_claims_v3` with `PENDING_OWNER_CONFIRMATION | CONFIRMED` state, fixture-only recipient/event refs.
   - `claim_owner_pairing_v3_synthetic`: Bot-side synthetic claim only; wrong code increments `failed_attempts`, max 5; code possession **never binds an Owner**.
   - `confirm_owner_pairing_v3_qa`: Dashboard-side simulated signed Owner identity, check `auth.uid()` matches issuer, shop membership still active, pending claim younger than 10 minutes, then consume challenge and bind exactly once.
4. Both functions use SECURITY INVOKER, are in a non-exposed private QA schema and have no `anon`/`authenticated`/`service_role` EXECUTE grants. No credentials or live Chat IDs have been introduced.
5. Candidate (review only): `qa/shop_owned/supabase_r1_owner_pairing_two_phase_candidate.sql`. Not auto-migrated or merged.

## TESTED — PostgreSQL staging
- Issuer-bound direct QA helper: **10/10 PASS** via simulated PostgreSQL JWT claim context.
- Two-phase claim + confirmation: **15/15 PASS** via simulated PostgreSQL JWT claim context, including:
  - Wrong Bot or wrong code rejected.
  - Claim created as PENDING, existing binding unchanged.
  - Duplicate / changed-recipient claim rejected.
  - Anonymous, same-shop different Owner and cross-tenant confirmation rejected.
  - Rightful Owner A/B confirmed successfully, replay denied.
  - Exactly two confirmed synthetic claims, three sandbox orders and three HELD outbox events unchanged.
- Brute-force/invalid-input tests: **10/10 PASS** — five bad codes lead to lockout; even the correct code is refused afterward; NULL inputs fail closed; zero notifications dispatched.
- These SQL tests are **not signed HTTP JWT positive tests**. They test only predicates given a mocked SQL Auth context.

## IMPLEMENTED + TESTED — GitHub CI
- Added `qa/shop_owned/pairing_v3.py` — isolated fixture-only SQLite pairing state machine.
- Added `qa/shop_owned/test_two_phase_pairing.py` — eight new synthetic tests: two-shop handshake, second Owner in same shop, cross-Bot, 5-attempt lockout, dedupe, expiry, invalidation on reissue and invalid ingress/session.
- Updated `.github/workflows/v12-r1-shop-owned.yml` to run both `test_shop` and `test_two_phase_pairing` instead of only historical tests.
- **GitHub Actions run [43520455846](https://github.com/ngoctien20/demo-git/actions/runs/43520455846): SUCCESS, 14/14 tests** (6 baseline, 8 V3).
- CI, SQLite and SQL staging fixtures are separate from production and contain no real customer information.

## Contract for future real integration (PROPOSED, not yet active)
1. **Dashboard** `POST /pairing/challenge`: verify signed Supabase Auth session and active Owner membership; issue a random, short-lived pairing code bound to the requester's Supabase user ID and exact tenant/store/bot.
2. **Trusted Zalo Bot Gateway** `POST /pairing/claim`: independently authenticate webhook/bot identity; derive Chat ID from verified provider request, not from an LLM/client field; hash or encrypt appropriately. Verify one-time code, enforce rate limits, create PENDING claim only.
3. **Dashboard** `POST /pairing/confirm`: revalidate signed Owner session, match original requester, display non-sensitive recipient fingerprint, require explicit confirmation, atomically bind Owner to Bot; prevent replay and concurrent takeover.
4. **Dashboard** `POST /pairing/revoke`: require current Owner membership; revoke pairing and invalidate pending notifications when recipient ownership is uncertain.
5. **Notification dispatcher** remains disabled and checks the CURRENT binding and `ZALO_SEND_ENABLED` before any send. Do not let Bot messages themselves authorize outgoing notifications.

## BLOCKED & SECURITY RELEASE GATES
- No signed-Owner-JWT positive 200/403 HTTP test yet. Earlier negative HTTP 401+401 tests do not prove success path.
- No verified, dedicated credential or service-to-service attestation for n8n -> backend; no real n8n/PostgreSQL HTTP commit path.
- No Bot-provider verified webhook-to-pairing claim; `claim_owner_pairing_v3_synthetic` must never be exposed directly or treated as provider proof.
- No dashboard UI for the second confirmation step yet.
- Historical one-step QA pairing functions remain private but must NOT be promoted to live bot flows.
- Supabase security advisor still warns about one existing authenticated SECURITY DEFINER RPC and leaked-password protection setting. Review separately, no permission change in this phase.

## Checkpoint, rollback and next execution
**Code:** draft PR #34, branch `work/v12-r1-shop-owned`, GitHub Actions run `43520455846` PASS.  
**Database:** new private QA-only table + functions, existing fixtures retained. Safe state: no frontend grants, no sender. Destructive rollback requires explicit approval after dependency audit.  
**Workflow:** no published n8n workflow changes; keep existing Owner Preflight Edge Function read-only and JWT required.

**NEXT P0:** actual signed JWT HTTP 200 own-shop / 403 cross-shop for Owner A/B in authorized staging login session (never paste JWT in chat).  
**NEXT P1:** provider-verified Zalo inbound contract and authenticated Dashboard confirm endpoint, then n8n -> backend scoped credential review.  
**NEXT P1:** staging E2E `Chat → Confirm → Sandbox Order → Outbox HELD` with separate audit evidence; no automatic sending.

Do not claim production readiness or complete two-way Owner pairing until the above release gates pass.
