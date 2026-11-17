# TIEN404 AI — V17.23L | Caller Reconciliation × Provider Ingress × Real JWT Admission

**DRAFT / SOURCE ONLY / NO HOSTED WRITE / REAL JWT NO-GO**

## Parent and scope
- Parent [V17.23K PR #358](https://github.com/ngoctien20/demo-git/pull/358), starting SHA `198a571aa768470a75a38e47b4af5cd4b8c635ec`.
- Direct live n8n audit: search_workflows returned 151 workflows, 22 active, 22/22 active Published node graphs reviewed; 1 has direct literal `qa_shop_b_zalo_claim`. Search limited to these three RPC names and literal `/rpc/` in node parameters; dynamic references, subworkflow internals not exhaustively established.
- Verified graph Zalo V1 `yIJk8LvJoLF40Z62` (Published `2d912cb0-007f-452f-9536-b92ba12a03e6`) invokes Zalo V2 `OgDZNSAvKEvhnAvn` (Published `f00ba506-c52a-4340-9a0c-809fd9c6ea9a`); V2 node `Submit pending claim for Shop B` calls `qa_shop_b_zalo_claim` via HTTP.
- Supabase: `qa_shop_b_zalo_claim` is SECURITY DEFINER, executable by anon, has a Vault-header secret gate; it is not proven unprotected nor proven provider-native signed. `qa_owner_pairing` and `save_merchant_product` are authenticated SECURITY DEFINER. No RPC execute or privilege writes during this audit.
- Meta Messenger `Z7FdV7uDvApfbURQ` has timing-safe HMAC signature verification Code node, but current verification is source/config structure, not independently exercised live signed event UAT. Zalo V1 has protected webhook configuration but native provider signature has not been independently attested. Source receipt must be verified and bound to canonical installation/store by private trusted runtime, not by LLM input.
- **Not global full inventory:** Cloudflare Workers, Supabase Edge Functions, external clients, inactive workflows, generated dynamic URLs, cloud audit trails and credentials were not comprehensively inspected. Permission revocation NO-GO until caller reconciliation and replacement compatibility are independently signed.

## Private JWT admission
Reuse private Owner Intake RPC12 PR #244 and Store provenance PR #354. Current M0 backup scope remains undecided and local real backup deferred by Owner. Hosted `public.stores`/store membership schema and real same-tenant A/B Owner evidence absent. 3 Auth users / 5 session DB rows never prove real issuer-signed Auth JWT A/B.
Future isolated no-send UAT requires independently attested Merchant Owner and Operator, dedicated disposable Store A/B under a single Tenant, cryptographically validated JWTs and active sessions, trusted backend Store resolver, store RLS positive A/A B/B and negative A/B B/A, forged user metadata, cross-customer, revoked sessions, replay, provider signature/installation and consent. No actual customer orders or outbound send.
`caller-ingress-admission.mjs` deliberately never authorizes real data reads, RPC REVOKE, public exposure, token verification, write/send or deploy, even all self-reported flags true. It is NOT an authenticated hosted runner.

## Rollback
Close Draft PR. No data, Supabase schema or permissions, workflow, credentials, customer messages, host or billing modified.
