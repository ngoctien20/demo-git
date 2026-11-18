# TIEN404 V18.1 — Messenger × Zalo × Commerce E2E Readiness Gate (NO SEND)

**2026-11-18 JST · VERIFIED READ-ONLY INVENTORY · SOURCE-ONLY QA · HOSTED E2E NO-GO**

This is an additive, synthetic/read-only **evidence checklist**, NOT an authentication service, identity bridge, Commerce writer, real channel router, or production release gate. This branch depends on the existing **V17.7H.4S** source branch PR #383 and must remain a Draft PR. Never merge or deploy it based on test colors alone.

## Existing work reused (do not rebuild)

- [PR #137](https://github.com/ngoctien20/demo-git/pull/137): synthetic Messenger→Zalo order continuity and disposable PG17 order tests.
- [PR #250](https://github.com/ngoctien20/demo-git/pull/250): single-use challenge / durable context / replay QA. Its **real-hosted NO-GO CI job intentionally fails** while source/PG17 jobs pass. Do not bypass the intentional failure.
- [PR #383](https://github.com/ngoctien20/demo-git/pull/383): Store-scoped signed channel/customer/order guard, NO SEND.
- [PR #385](https://github.com/ngoctien20/demo-git/pull/385): private Owner A/B protected server-auth candidate P0T, source only. Owner authorization must never be mistaken for customer cross-channel identity.

## Evidence captured (private-data-free)

- n8n Messenger QA `Z7FdV7uDvApfbURQ` had a successful webhook execution `5236`; this does **not** certify a Commerce order was persisted. Its published ordinary tools still reference AI_SALES_DEMO. Keep DEMO Orders/Products/credentials isolated.
- n8n Zalo Bot Lab `yIJk8LvJoLF40Z62` lists manual executions only; its current published route acknowledges without sending a customer reply. No recent native webhook-to-Commerce order proof was found in the queried execution history.
- Cloudflare Worker `tien404-v1723u-qa-inbound-locked-staging` read-only source inspection detects QA challenge/405/404 and NO_SEND semantics, but no direct `ngoctien20.app.n8n.cloud` webhook forwarding in that Worker. This is **not proof no other forwarding path exists**. No scripts, routes, bindings or secrets were changed.
- Supabase staging `ifxlvrhyjhbzbrkdsida`: `tien404_v175_qa` has eight empty identity/ownership/replay/consent tables; all have FORCE RLS and deny direct `anon` / `authenticated` SELECT. Current `public.orders` is Tenant-scoped; canonical same-Tenant Store A/B authorization is not hosted.
- Render `tien404-data-staging` is an older deployed FastAPI; direct origin allows `0.0.0.0/0`. No dedicated Cloudflare Access private verifier app was found in the four Access apps listed. Never mount P0T on this origin until protected.
- n8n offline tests: executions `5315` 12/12 and `5316` 25/25 + 40/40 PASS, **synthetic only**.

## Independent acceptance order (ALL required)

1. QA inbound event from **real Zalo QA Bot or OA**, verified at the official provider and traced to the intended protected n8n staging workflow; never assume Bot API and OA are interchangeable.
2. Signed bot installation→trusted tenant+canonical Store mapping at the server, tenant/store routing never taken from customer messages.
3. Independent customer A consent for linking separate Messenger PSID and Zalo sender; one-use durable challenge with expiry, rate-limit, revoke, and no matching by name/phone/order code alone. Owner A/B sign-in is a different proof.
4. A Commerce staging (not AI_SALES_DEMO) test order is persisted with an authoritative Store/customer link, server-derived amount, stock and idempotency.
5. The *same verified customer A* queries that order on Zalo QA; the server enforces tenant, Store, order ownership. Missing link -> VERIFY_REQUIRED / DENY.
6. Different customer B cannot read A's order despite knowing the order key and phone; separate Store B and tenant B are denied; sender spoof, duplicate event, cancelled/revoked session and replay fail closed.
7. Private owner A/B real signed sessions, origin Access enforcement and true same-Tenant Store A/B QA completed independently, under separately documented operator consent.
8. Real tested backup+restore / M0, reviewed staging migration and independent security approval. Hosted rollout, provider send and production require separate explicit approvals.

## Source artifacts

- `qa/v181-crosschannel/verified-readonly-snapshot.json`: source observations without PII/JWT/secret, reflecting **NOT VERIFIED**, not metaphysical proof events never happened.
- `qa/v181-crosschannel/e2e-evidence-gate.mjs`: pure deterministic report with 14 required signals; **every possible result** has `orderWriteAuthorized=false`, `outboundMessageAuthorized=false`, `hostedReleaseAuthorized=false` and `productionReleaseAuthorized=false`.
- `qa/v181-crosschannel/e2e-evidence-gate.test.mjs`: negative/forgery tests; no network.
- `.github/workflows/v181-crosschannel-e2e-evidence-no-send.yml`: source-only CI.

Do not change any evidence signal from false to true without an independently read, private, authorized verification receipt. A manually edited JSON or a green CI test provides **zero real provider authorization**.

## Change boundary, risk, rollback

**Risk:** Misreading a synthetic source test as permission to send or read private orders. Mitigation: explicit NO-GO status, full false authority outputs, private signed external evidence gate and no runtime integration.

**Changed:** Added source-only files on a new feature branch; no n8n execution with live provider, no Supabase DDL/DML, no Cloudflare Worker deployment, no Render deploy, no webhook registration, no customer writes, no credentials.

**Rollback:** Close the Draft PR / delete its feature branch. No hosted rollback necessary.

**Next operator step:** only on authorized QA accounts and only on the previously agreed QA bot: send a non-PII diagnostic message and correlate a new provider event ID against the protected QA ingress and n8n execution **without requesting an order or providing personal data**. This requires separate confirmation of the correct callback identity, not a production webhook change.
