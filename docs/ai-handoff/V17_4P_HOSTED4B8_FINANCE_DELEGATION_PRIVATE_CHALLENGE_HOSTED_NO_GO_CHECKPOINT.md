# TIEN404 AI — V17.4P-HOSTED.4B.8
## Verified Finance Delegation × Private Identity Challenge × Hosted Intake Admission

**Date:** 17 Nov 2026 JST. **Status:** IMPLEMENTED source-only / LOCAL CI QA pending; **hosted private intake and real finance authorization: NO-GO**.

**Parent:** Draft PR [#329](https://github.com/ngoctien20/demo-git/pull/329), exact HEAD `d780435429954bf01d84982aea8b9f0b1c7df5d9`, **547/547 PASS**. This child branch is not merged or deployed. Do not modify RPC16, V17.5, Zalo V17.21H.2, Commerce, Supabase, n8n or production.

## 1. Current independent Cloudflare GET-only evidence

At **2026-11-17T12:15:16.950Z** (21:15 JST):
- Worker entities **30/30**; Worker scripts **30**.
- Durable Object namespaces **3/3**: V17.5E.2 ReplayBucket, V17.5E.2A RunnerResults and Zalo V17.21H.2 ZaloBotReplayBucketV2 (name, class and owning Worker retained).
- Access applications **2/2**, Access policies **0/0**, account members **1/1** accepted with `Super Administrator - All Privileges`. Access RPC16 remains DENY ALL. New V17.4P QA Worker and standalone permit ledger absent.
- **GET billing/spend-policies: 403 FORBIDDEN**. The actual Finance spending policy is not readable through this connector. The prior successful read-only connector-member match proves account authorization *at the moment of inspection*, not human owner consent, finance independence or signed dollar budget.
- Snapshot timestamps are audit history; **no live approval may reuse them**. Re-collect full immutable Worker/DO/Access/member inventory immediately before any separately authorized hosted operation.
- Cloudflare operations here were **GET only**; no billing, Access, R2, DNS, worker, DO or deployed secret change.

## 2. Implemented review-only Finance delegation & identity challenge

Source: `qa/v174p-private-hosted/hosted4b8-finance-delegation-private-challenge.mjs`.

The new gate reviews the mathematical consistency of **five independent Ed25519 public-key roles** (Owner, delegated Finance, independent Auditor, private identity Broker, one-use Challenge Ledger), without making network calls or deploying a service.

**Owner delegation:** a metadata-only fixed-key JSON contract specifies exact target `tien404-v174p-private-permit-ledger`, account, immutable Git source SHA, manifest/inventory SHA-256, pseudonymous Owner+Finance+Auditor+Rollback subjects, private `EV-...` legal mandate reference, both positive USD risk allocations, cost window, unique cryptographic nonce and expiry <=24h. Independent Owner signature grants scoped delegation; independent Auditor signature reviews it; Finance independently signs acceptance. No public URL, Access modification, billing edit, secret, existing Worker mutation, Commerce or provider send.

**Private identity challenge:** dedicated signed 120s nonce challenge bound to the delegation hash, **separate Owner and Finance phishing-resistant MFA signals**, distinct 5-minute authenticated sessions, immutable audience and phase. The independent Broker signs the issuance; Owner and Finance each separately sign the exact challenge response.

**Replay receipt:** a separate Challenge Ledger key signs the nonce receipt with exact nonce hash, delegation digest and bounded timestamp ordering. The test receipt state is named `SYNTHETIC_RECEIPT_NOT_HOSTED_PROOF`; source-only mathematical validation **never attests to actual durable one-use reservation**. Real nonce/permit replay prevention requires a separately deployed, protected and tested hosted ledger, which is not present.

**Finance:** authentic Cloudflare billing evidence or independently authenticated Finance audit evidence is required, bound to Finance consent digest, with fresh timestamp. `403 FORBIDDEN`, missing cost delegation, missing actual Finance signatory or fake `READ_ONLY_VERIFIED` fields **must remain NO-GO**. Test fixtures with signed `READ_ONLY_VERIFIED` status do not prove live billing authority; the validator always returns `billing_access_or_budget_verified:false`.

**Absolute NO-GO by construction:** even positive synthetic crypto math returns:
`real_finance_mandate_verified:false`, `actual_private_challenge_verified:false`, `nonce_replay_durable_verified:false`, `can_create_ledger:false`, `can_upload:false`, `mutations_executed:false`.

### Files / QA

- `hosted4b8-finance-delegation-private-challenge.test.mjs`: 52 synthetic positive/negative tests: forged and reused signing keys, owner/Finance/Auditor separation, phantom finance rights, budget tamper, MFA freshness, nonce TTL/cross-phase replay, protected DO class/owner mutations and malicious fields.
- `hosted4b8-finance-delegation.pending.example.json`: all real finance roles, legal mandates, challenge and budgets unapproved/`null`; no credentials, human PII or legal documents; hosted actions false.
- Existing CI must retain 16 real **LOCAL Workerd SQLite** replay and permit-ledger atomicity tests and 21 local Chromium synthetic-Access browser tests. Cloudflare hosted private intake UAT and real Commerce Store-RLS tests remain intentionally skipped.

## 3. Real private admission prerequisites (not implemented)

- Independently registered user and Finance identities, confirmed organizational/legal mandate, separate authority to audit Finance consent, MFA sessions and revocation status verified **outside GitHub and this chat**.
- Protected private intake service with Cloudflare Access All Traffic / separate Owner, Finance and Security policies, no public development URL, shortest-lived JWT/session, no raw Merchant documents in logs or PR, audit-controlled private evidence references. Cloudflare `ctx.access` on a directly authenticated Worker is not a legal authorization or payment approval.
- Independently registered Broker and Challenge Ledger signing keys; authoritative one-use claim persistence, not a caller-supplied receipt flag; force fresh Cloudflare inventory and real billing approval signed for each step, with rollback and cost exposure reviewed.
- Explicit authorized budget envelope per resource and current account-level billing exposure acknowledgement; Cloudflare spend limits are account-wide, not guaranteed per-resource hard invoice caps; Durable Object storage may be outside spend stops. No cost action permitted here.
- First approved **private ledger inactive upload**, independently verified postflight, then a different approval window for the **QA Worker inactive upload**. No automatic progression or inherited Finance consent.

## 4. Rollback, production gate and proof provenance

- Rollback of this source-only change: close/revert child Draft PR; parent #329 and all Cloudflare production resources remain untouched.
- The local crypto tests model signatures with ephemeral synthetic keys. Passing them is **not** real owner delegation, Finance legal authority, MFA verification, authenticated Hosted Intake UAT or authorized hosted upload.
- Do not merge, expose any public URL, create billable services or change Cloudflare account billing/Access without independent verified approval. Do not turn an API 403 into `READ_ONLY_VERIFIED`.

## Official references
- https://developers.cloudflare.com/billing/manage/spend-management/
- https://developers.cloudflare.com/billing/understand/billing-permissions/
- https://developers.cloudflare.com/workers/configuration/cloudflare-access/
- https://developers.cloudflare.com/durable-objects/platform/spend-management/
