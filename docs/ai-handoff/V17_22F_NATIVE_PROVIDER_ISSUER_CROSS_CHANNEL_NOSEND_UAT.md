# TIEN404 AI — V17.22F: Native Provider Protocol Proof × Private Identity Issuer × Cross-Channel NO-SEND UAT

**17 November 2026 JST · DRAFT / SOURCE ONLY · NO WEBHOOK CUTOVER · NO SEND · NO HOSTED DB WRITE**

## Verified parent and existing source inventory

Child of [V17.22E Draft PR #363](https://github.com/ngoctien20/demo-git/pull/363), exact pinned HEAD `91ff9fe14537c728c8a45f5a1a12c32f541b0244`. Existing tested components reused:

- `qa/v1722-cross-channel-order/private-channel-identity-admission.mjs` — V17.22E Ed25519 receipt verifier bound to event/sender/Tenant/Store, with explicit `SYNTHETIC_ONLY`.
- `qa/v1722-cross-channel-order/qa-command-router.mjs` — V17.22B exact QA commands, no default Agent fall-through and no Commerce write/send.
- `qa/v1722-cross-channel-order/cross-channel-qa-core.mjs` — V17.22B in-memory dual-channel order/OTP/identity simulation, **only for synthetic UAT**.
- `qa/v171-channel-first/native-ingress-qa.mjs` — original isolated Meta-HMAC-shaped and Zalo-Bot-shared-header QA protocol behavior; V17.22F reuses protocol distinctions, not its embedded fixture secrets/installation mappings.
- `qa/v1720-zalo-replay/zalo-bot-replay-gate.mjs` — existing Zalo Bot replay contract; V17.22F uses an **injected** replay-claim callback rather than deploying or replacing the already-tested durable staging replay service.
- V17.22C/D/E PostgreSQL 17 QA scripts and GitHub CI inherited unchanged, including two independent concurrent PostgreSQL sessions.

Current connected n8n workflow readback (read-only) confirms Messenger `Z7FdV7uDvApfbURQ` **Published 32 nodes**, Zalo Bot `yIJk8LvJoLF40Z62` **Published 12 nodes** and Commerce sandbox `iyfGUiEsZlNTBWOR` **Published 19 nodes**. **No changes have been applied** to these real workflows, their webhooks or Page/Bot credentials.

Parallel owner-authentication/recovery scope remains on [#352](https://github.com/ngoctien20/demo-git/pull/352) and [#354](https://github.com/ngoctien20/demo-git/pull/354). No reimplementation or rollout of these gates in V17.22F.

## What was added

`qa/v1722-cross-channel-order/native-proof-private-issuer-nosend.mjs` is a **new isolated source-only adapter**, not a production bot:

1. Receives only exact internal transport shape `{channel,route_ref,raw_body:Buffer,headers}`. Enforces bounded **raw bytes** before JSON parsing, exact single-message text/actor shape, 5-minute timestamp bounds, same-Page recipient, private Zalo Bot chat and no untrusted Store/Tenant/role fields.
2. Messenger: checks `X-Hub-Signature-256: sha256=<64 hex>` using constant-time HMAC-SHA256 over the **original unmodified Buffer** with a **per-installation test key injected privately**. In testing, all secrets are fake. Actual Meta App Secret, Page ownership and subscribed_apps have **NOT been verified**. See [Meta webhook reference](https://developers.facebook.com/docs/graph-api/webhooks/getting-started/).
3. Zalo Bot: compares the injected private `X-Bot-Api-Secret-Token` with a shared header value using constant-time comparison. **This is NOT a per-body HMAC and NOT a Zalo OA `X-ZEvent-Signature` or Merchant OA ownership proof.** Zalo Bot and OA are separate integrations, not interchangeable.
4. Uses server-injected, **synthetic-only** Page/Bot→Tenant/Store installation registry with `owner_verified=false`; rejects client Store values, missing/revoked installation, timestamp/replay abuse.
5. Calls injected `claimReplay` with keyed event ID and raw-byte payload digest. **No hosted durability is asserted.** In-memory replay implementation is for CI only; a real atomic replay service must be supplied and tested separately.
6. Only after valid synthetic native-shaped protocol verification/replay claim, signs an **ephemeral CI Ed25519 private receipt** bound to channel, exact event, sender digest, Tenant and Store. Passes it through the existing V17.22E receipt verifier and exact V17.22B QA Core router. Inherited internal `provider_verified=true` means **only synthetic verifier passed**, and externally `native_provider_verified=false`, `real_store_owner_verified=false`, `issuer_receipt_scope=SYNTHETIC_ONLY`, `provider_sends=0`, `commerce_writes=0`.
7. Real network/provider sends, LLM and Commerce writes have **no implementation path**; callable send/write functions explicitly throw.

**Security caution:** Zalo Bot header secret provides shared-token transport checking only; it does **not** cryptographically sign each event body, independently prove Zalo network origin or protect from an attacker who has that secret. Meta fake HMAC keys merely exercise the real cryptographic algorithm; **no live Meta credential, external Page event or actual native authentication success is present.** SHA-256 of sender in the signed receipt is an existing source-only QA contract; production must use a private keyed HMAC/pseudonymous account ID and private retention rather than exposing plain hashes.

## Cross-Channel no-send UAT coverage

`native-proof-private-issuer-nosend.test.mjs` exercises native-shaped Meta raw-body and Zalo Bot header test envelopes, forged Store/Tenant, signed body tampering, wrong actor, stale timestamp, unknown/revoked channel, wrong HMAC, wrong Ed25519 verifier, duplicate/replay conflict, no-send outputs and external-provider no-go.

A **composed in-memory QA-only** scenario tests this complete **synthetic** path:

- Meta QA Account A command `QA_ORDER PREVIEW QA_SKU_001 2` → native-shaped proof → private issuer → exact QA router → **test-only local order preview**.
- Account A `QA_ORDER CONFIRM <preview_ref>` → synthetic order ref kept **in test process memory only**; no real commerce transaction.
- Zalo QA Account A requests same order status **before** identity link → DENY.
- Messenger `QA_LINK START` → Zalo `QA_LINK CODE` → original Messenger `QA_LINK CONFIRM` → two-code synthetic account link.
- Zalo QA Account A requests same synthetic order → receives only fake status. Another Zalo A/B actor, another Messenger account and Store B Zalo Bot are DENIED.
- Original V17.22B lab performs a second *synthetic signed-envelope verification* inside the test harness. This is intentionally a **composed source-only test**, **not** actual deployed provider-to-persistent-Commerce linkage, real JWT Store isolation or official owner consent.

The CI preserves all inherited V17.22E exact-head QA and two-client PostgreSQL 17 race tests.

## Explicit acceptance statuses

| Gate | Decision |
| --- | --- |
| Meta raw-byte HMAC algorithm exercised with ephemeral fake secret | SOURCE TEST; not real Meta validation |
| Zalo Bot shared secret-header algorithm exercised with fake secret | SOURCE TEST; not real Bot account proof |
| Ed25519 private signed synthetic no-send admission | SOURCE TEST; not real owner proof |
| Messenger QA order → Zalo Bot status → unlinked/foreign actor DENY | SOURCE-ONLY in-memory composed QA; not live |
| PostgreSQL 17 concurrent OTP row lock from V17.22E | Inherited TESTED (disposable GitHub PG17 only) |
| Actual provider-origin credentials, Meta Page & Zalo Bot installation | BLOCKED |
| Independent Store A/B source ownership, hosted RLS and two real JWT | BLOCKED, owned by parallel workstream |
| Durable provider replay + least-privilege QA order ledger | NOT CONNECTED |
| Native Zalo OA OAuth / signature | Separate NO-GO |
| Real customer/QA account send canary and Commerce writes | NO-GO; require explicit approval |

**No** n8n Published edits, Supabase migration, real customer/Order/Payment/Stock data access, Meta/Zalo/Cloudflare deployment, paid model calls, credential moves, changes to older PR branches or external sends.

**Rollback:** close this child Draft PR. Parent #363 remains pinned and working; hosted state unchanged.

**Checkpoint:** `V17.22F_NATIVE_SHAPED_FAKE_KEY_QA · PRIVATE_SIGNED_SYNTHETIC_ISSUER · COMPOSED_NO_SEND_UAT · REAL_PROVIDER_AND_STORE_NO_GO`.
