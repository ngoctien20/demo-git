# TIEN404 AI — V14.5Z-G2.2 — Signed Provider Bot → QA Shop B Candidate Mapping
**Date:** 2026-11-16 JST  
**Branch:** `work/v145z-live01-limited-uat-gate`, **PR #103 DRAFT**  
**Release classification:** `CANDIDATE` — isolated staging, NO SEND, NO OWNER CERTIFICATION.  
**Final result:** actual provider identity maps cryptographically to **one QA Shop B candidate**, not yet an authorized merchant/Owner or production channel.

## 1. Scope and authorization
User explicitly requested G2.2 Trusted Bot → Shop B Mapping after approval and successful G2.1. Implement isolated candidate mapping by comparing a newly issued **real Zalo getMe server-signed proof** with a privately enrolled Shop B record and server-pinned Supabase staging tenant identity. Do not promote existing synthetic fixture data, modify Supabase records or permission grants, activate Published ingress, send Zalo, create Orders, alter Bot Token or pay for an n8n plan.

## 2. Hosted baseline audit (read-only)
- Supabase project `tien404-staging` (`ifxlvrhyjhbzbrkdsida`) is **ACTIVE_HEALTHY**. Tenant slug `qa-staging-shop-a-20261110` has 1 active Owner membership; `qa-staging-shop-b-20261110` has 2 active Owner memberships. These are **staging membership records**, not proof either user controls the Zalo Bot or has authorized a merchant channel.
- `tien404_r1_qa.tenant_identity_map` has two synthetic references `qa-tenant-a/qa-store-a/qa-bot-a` and `qa-tenant-b/qa-store-b/qa-bot-b`, both linked to actual Supabase QA tenant rows. **Neither synthetic bot fixture has been promoted**.
- Supabase `app_private.channel_secrets`: **0 rows for platform Zalo**. This is intentional; no Zalo credentials or tenant channel configuration written there in G2.2.
- n8n QA bot registry table `qLf19z9QjEaIHk00`: 2 `zalo_bot_fixture/synthetic_qa/dry_run` rows unchanged. Owner allowlist `dRPj5k0t51hihJUW`: existing `ALLOWED_STAGING_OWNER` row expires **2026-11-20 13:17:32.511 UTC (22:17 JST)**; allowlist alone is not merchant ownership evidence.
- Published Zalo staging ingress `yIJk8LvJoLF40Z62`, version `8ca4a6f6-ab3f-42f1-8637-d4f5db790a3e`, remains unchanged; its Shop B link is still **synthetic** and must not be treated as G2.4 certified.
- Existing G2.1 credential-bound staging Worker `tien404-zalo-outbound-v1-staging` stays on version `3422864f-f095-45b9-85ca-a7d03cb87a3f`; `ZALO_SEND_ENABLED=false`, no Bot Token changes.

## 3. G2.2 implementation — isolated, non-production
- New **dedicated empty** Cloudflare D1 QA database, created APAC: `tien404-g22-botmap-qa-staging`, UUID `4453cadb-3f0e-427c-bc7c-57267878230e`. It is NOT the prior LIVE01/D1 replay database and NOT customer/production storage. No existing D1 schema or customer records changed.
- Draft-only migration `qa/zalo-live-v145z/g22-isolated-d1-staging-schema.sql` created immutable candidate table `g22_trusted_bot_candidates`. Constraints pin `qa-staging-shop-b-20261110`, `qa-store-b`, `owner_certified=0`, status CANDIDATE/REVOKED only, and forbid raw Bot ID/token in the schema.
- Authoritative Shop B staging tenant ID retrieved from **Supabase read-only**, with active memberships counted, then reduced to a private row + a SHA256 pin (`81902d42f087c86b28f5d986cce0f2101f79d6c55f7c9a3c3885d317c41fc994`). The raw tenant UUID is never emitted by the resolver and is NOT included in this public checkpoint.
- G2.1 inactive n8n private attestor workflow `bOjbj4MZIZnMn8XP` execution **3880 SUCCESS** issued fresh real provider `getMe.result.id` evidence; the certificate was cryptographically verified with the pinned G2.1 public key and confirmed as still fresh. Its HMAC Bot digest + challenge (NOT raw Bot ID), source, QA tenant identity and status were inserted via private Cloudflare administrative API into the new QA D1. **Exactly one CANDIDATE row**, Owner=0, expires **2026-11-18 20:33:02.859Z / 2026-11-19 05:33 JST**, no automatic renewal or promotion.
- New standalone Cloudflare Worker `tien404-g22-shop-b-map-nosend-staging`, URL `https://tien404-g22-shop-b-map-nosend-staging.tienmobi208.workers.dev`, deployed version `8e458c9c-3231-451c-9229-e26e171d47c3`, deployment `f7645755-5940-460e-9068-cf831024aa40`.
- **Exactly one Worker binding:** `G22_QA_DB` (isolated D1). **Zero credential, Bot Token, signing private key, Gateway key, Supabase secrets or customer data bindings.**
- Worker code `qa/zalo-live-v145z/g22-trusted-bot-resolver-worker.mjs` + `g22-trusted-bot-resolver-core.mjs`: verifies G2.1 signature against *public pinned SPKI*, proof time and Zalo getMe provenance, exact challenge+Bot HMAC digest matching one D1 candidate, actual Supabase QA tenant SHA pin, Shop B slug/store pin. It **ignores client-supplied tenant/Shop claims** and never returns tenant UUID, Bot ID, proof digest, Owner Chat ID or customer data. No write API.
- `GET /health` is non-sensitive; `POST /v1/resolve-bot` accepts only a signed proof; `/v1/send`, `/webhook*`, `/api/order*` and `/v1/provider*` always return **HTTP 423**. **No OAuth, Orders, Messenger, notifications or Zalo outbound integrations were modified.**

## 4. Test evidence
- Local synthetic offline/contract suite `qa/zalo-live-v145z/g22-trusted-bot-resolver.test.mjs` **45/45 PASS**. Tests invalid signature, expiry, wrong Bot digest/challenge, wrong tenant UUID or Shop A, wrong slug/store, synthetic registry, Owner boolean spoof, revoked/expired candidate, D1 failures and all no-send routes.
- Existing GitHub CI [43758263470](https://github.com/ngoctien20/demo-git/actions/runs/43758263470) **SUCCESS**, 45 additional cases; inherited **409** gives **454/454 total PASS** (including 11 Python backup fixtures and 18 existing regression cases). Two preceding CI runs had new test syntax/import issues and were corrected before any Worker or D1 candidate activation: runs `43758124360` and `43758193715`.
- INACTIVE n8n QA workflow `znp3ABDLUH5bTqFE`, version `5b80026b-ea3a-4f3f-b677-3452348c0b43`, manual execution **3881 SUCCESS**: G2.1 calls actual read-only Zalo getMe, new signed proof passed to G2.2, HTTP 200 `SIGNED_PROVIDER_MATCHES_SHOP_B_QA_CANDIDATE`, `QA_STAGING_SHOP_B_ONLY` scope, owner false, no send, no Orders. `POST /v1/send` HTTP 423 and `GET /health` 200.
- INACTIVE n8n QA workflow `gMN4W0elrxEPmJ61`, manual execution **3882 SUCCESS**: missing signed proof HTTP 422; malicious Shop A tenant override HTTP 422; send path HTTP 423; health HTTP 200, zero secret bindings.
- Post-QA read-only Cloudflare: one D1 row `status=CANDIDATE, owner_certified=0`; G2.1 Worker still has flag `false`, G2.2 Worker only isolated D1 binding; Published n8n Zalo ingress unchanged. n8n latest observed **107 workflows / 19 Active**, new QA workflows are INACTIVE.

## 5. Critical distinction — technical candidate versus certified channel
**VERIFIED:** server-signed actual Zalo provider Bot identity matches the **privately pinned QA Shop B candidate record**, current Supabase QA tenant hash and D1 record. A wrong Bot ID, wrong signature or Shop A request fails closed.
**NOT VERIFIED:** an independently authenticated Zalo Owner actually authorized this Bot to act for merchant Shop B; a real Bot→Store tenant connector configured and provisioned for real commerce; a real webhook ingress de-syntheticized; a four-issuer Owner/provider/registry/hosted certificate with durable replay guard.
The shared fixed G2.1 challenge provides a stable HMAC matching value, but it is **not** a durable single-use nonce attestation. Proofs have 120-second TTL. Genuine replay-hardening remains a G2.5 gate. A valid proof can be replayed during its short TTL only to the read-only candidate resolver, with no send/order/promotion endpoint.

## 6. Roadmap and next approval
- G0 safety: VERIFIED.
- G1 synthetic owner browser UAT: ACCEPTED_BY_USER_SELF_REPORT (8/8), not real commerce.
- G2.0 provider getMe + webhook: VERIFIED.
- G2.1 privacy-safe signed real provider ID: VERIFIED.
- **G2.2.1 pinned real provider proof ↔ one Shop B QA candidate: IMPLEMENTED, HOSTED TESTED, VERIFIED TECHNICAL MATCH.**
- **G2.2 channel/merchant ownership certification: PENDING G2.3**. Do not label fully trusted commerce channel.
- G2.3 independent QA Owner enrollment, consent and allowlist reauthorization: BLOCKED; requires separate specific approval for any changes to Owner permissions/data and merchant identity.
- G2.4 Published ingress: BLOCKED; no synthetic-to-real promotion.
- G2.5 independent four-issuer signed evidence + atomic replay store: BLOCKED.
- G3/G4/G5 real AI, sends and paid commercialization: NO-GO pending separate release approvals.
- n8n Trial choice remains defer until the scheduled **2026-11-22** review. User Export workflow backup still not certified restore-ready; do not treat this D1 registry as a commerce backup.

## 7. Risk, checkpoint and rollback
- Current G2.2 Worker contains no credential, has no client data writes or outbound provider calls. To stop G2.2 QA, disable only **its isolated Worker subdomain/deployment**, leaving Zalo G2.1 and legacy Worker unaffected. Candidate record naturally expires at Nov 19 05:33 JST. Optional administrative status change to REVOKED requires narrowly scoped user approval; do NOT destroy any D1 database or customer data.
- All GitHub code remains in Draft PR #103. No production merge, no new Supabase RLS/GRANT/credential/owner membership, no real user messages, no Zalo sends and no billing changes.
- Evidence summary for automation: `qa/zalo-live-v145z/g22-hosted-qa-evidence.json`; source-only migration `g22-isolated-d1-staging-schema.sql`; independent offline and hosted QA logs above.
