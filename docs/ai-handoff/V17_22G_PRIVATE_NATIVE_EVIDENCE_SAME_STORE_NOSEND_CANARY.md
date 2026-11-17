# TIEN404 AI — V17.22G Private Native Provider Evidence × Same-Store Authorization × Isolated No-Send Canary

**Checkpoint:** 17 November 2026 JST. **DRAFT / SOURCE-ONLY / PRIVATE EVIDENCE ORIGINALS UNVERIFIED / HOSTED NO-GO.** No changes to production or staging infrastructure.

## 1. Exact inheritance and responsibility split

Pinned parent is [V17.22F Draft PR #369](https://github.com/ngoctien20/demo-git/pull/369), HEAD `330a9b14fbabfb68a0170f86fc8cc89c64c0b670`. This PR does **not** duplicate F's native-*shaped* Meta HMAC/Zalo Bot header, ephemeral signed QA issuer, cross-channel order lab, or E's real two-client PostgreSQL OTP test.

Adjacent non-merged work remains independently owned:
- [V17.MULTI-CHANNEL-03B PR #310](https://github.com/ngoctien20/demo-git/pull/310) signs **opaque owner-review metadata** with two Ed25519 keys but explicitly returns `realMerchantOwnerVerified=false`. The signatures are not Merchant proof.
- [V17.23I PR #352](https://github.com/ngoctien20/demo-git/pull/352) and [V17.23J PR #354](https://github.com/ngoctien20/demo-git/pull/354) handle Store provenance, current M0–M5 migration gates and real-JWT admission. **No Auth, Store schema, M0 or private original evidence work is duplicated in this PR.**
- Meta Messenger and Zalo Bot are distinct integrations. The Bot `X-Bot-Api-Secret-Token` is a shared secret, NOT a per-body signature, NOT independent network origin, and NOT Zalo OA's signature.

## 2. Read-only hosted baseline independently checked for G

On 17 November 2026 at 14:25 UTC, a read-only, aggregate-only query of Supabase staging `ifxlvrhyjhbzbrkdsida` confirmed:

| Surface | Actual observed |
| --- | --- |
| `public.stores` | Absent |
| `public.store_memberships` | Absent |
| `public.channel_identity_links` | Absent |
| Isolated `tien404_v1722_qa.orders` hosted ledger | Absent |
| Store-scoped `store_id` on 6 core Commerce surfaces | **0 of 6** |
| Permissive `public.orders` SELECT RLS policies | **1** |

Published n8n readback, **no edits**:
- Messenger `Z7FdV7uDvApfbURQ`: active Published version `1064b1b3-d3f1-4a6b-a367-2414ba691522`, 32 nodes, existing Messenger reply HTTP node and legacy order tools (unsafe for new unprefixed QA orders).
- Zalo Bot `yIJk8LvJoLF40Z62`: active Published version `2d912cb0-007f-452f-9536-b92ba12a03e6`, 12 nodes, protected webhook, no customer reply node in reviewed graph.
- Central Commerce sandbox `iyfGUiEsZlNTBWOR`: active Published version `456862c9-e5ee-4bfa-9931-47dbc39ab73d`, 19 nodes, not the authorized Store-scoped shared transaction writer.

**Verdict:** Neither same-Store identity authority nor a safe hosted order ledger can currently be certified. An offline CI success must NOT be promoted into a real Page/Store/Bot binding or customer Order-read permission.

## 3. New Source-only Private Evidence Gate

`qa/v1722-cross-channel-order/private-native-evidence-samestore-gate.mjs` accepts only a strict five-minute private NO-SEND manifest:

`tenantAlias`, `storeAlias`, `metaPageAlias`, `zaloBotAlias`, opaque consent/ticket/nonce, `isolatedNoSend=true`, `productionUnchanged=true`, `commerceWritesDisabled=true`, `modelCallsDisabled=true`, `privateOperatorOnly=true`, `recoveryGate=DEFERRED_NOT_WAIVED`.

Four **distinct, separately pinned** Ed25519 signer roles must sign canonical bounded metadata notes referencing that exact manifest hash, nonce, Tenant/Store and installation:

1. `META_PROTOCOL_REVIEWER` — Meta *raw-body HMAC source review metadata only*.
2. `ZALO_BOT_PROTOCOL_REVIEWER` — Zalo Bot *shared header protocol review metadata only*.
3. `MERCHANT_OWNER` — original Merchant ownership **still pending independent adjudication**.
4. `INDEPENDENT_SECURITY_REVIEWER` — independent private original-evidence review **still pending**.

Checks: separate key/actor identifiers, valid unrevoked time-bounded signer keys with exact Tenant/Store scope, exact role-method-to-channel pairing, no reused evidence refs, exact signed claim fields and canonical signature bytes; no client Store/role elevation, mismatch, expired manifest or approval flags.

**Even after all four syntactically valid signatures pass**, result is **`STRUCTURAL_FOUR_REVIEWER_CANDIDATE_ONLY`**, explicitly:
`privateOriginalsReviewed=false`, `nativeMetaProviderVerified=false`, `nativeZaloBotProviderVerified=false`, `merchantOwnerVerified=false`, `realJWTStoreVerified=false`, `mayRunHostedNoSendCanary=false`, `mayReadCustomerOrders=false`, `maySend=false`, `mayWrite=false`.

This is **not** a method to collect credentials or original Merchant evidence through GitHub/ChatGPT. A signature check cannot establish the signer is an actual real Page/Bot owner. Original evidence should remain private under an approved role-limited process, with only opaque aliases/status references exposed.

## 4. Isolated no-send canary scope

The new [GitHub Actions source-only workflow](../../.github/workflows/v1722g-private-evidence-nosend-canary.yml) runs `private-native-evidence-samestore-gate.test.mjs` **without PostgreSQL, provider tokens, hosted API calls, model requests or customer records**. It exercises four separate ephemeral test keypairs, same-Store and cross-Store/Tenant/role/consent attacks, and one fake signed Meta QA order-preview event through the existing F in-memory private QA issuer. Tests verify exactly zero sends/writes and refuse all actual hosted canary promotion.

The inherited V17.22C/E/F CI additionally runs all previous 127 Node cases, the G evidence suite, forced RLS/PG17 FK/OTP tests and the true two-independent-`psql` concurrent claim. Hosted native provider canary job is disabled by `if: false`.

**This is an isolated source-only canary, not an external no-send webhook UAT.** Even a perfectly formed fake provider HMAC is NOT proof of actual Meta App Secret, Page authority or Zalo Bot creator identity.

## 5. Private real-provider evidence and GO/NO-GO

**Before any separate hosted, opt-in NO-SEND canary can be approved**, the private reviewers must independently verify:

- The existing authorized Meta QA Page/App is a dedicated non-production Page, provider-native HMAC on a real QA event is verified with securely held App Secret, the tester is authorized, subscription/callback route is isolated and legacy send responders are not duplicated.
- The exact authorized Zalo **Bot** QA installation and real creator/operator can independently prove Bot `getMe`/secret header under controlled private access. A shared header is not per-body native origin signing; Zalo OA is a separate project gate.
- Signed independent Merchant Owner + Security Reviewer approval binds the **same** canonical Store to both Page and Bot, not just the same Tenant. Real Store A/B Auth/JWT, membership, Commerce RLS and privacy boundaries have been accepted.
- Atomic durable provider replay/OTP, private least-privilege QA ledger, one-event cap, redacted log, time-limited operator session, explicit disable/rollback, current M0 recovery acceptance and **operation-specific authorization** are documented.
- Real callback/test identity material, any actual JWT, Meta/Zalo token, phone or customer details NEVER enter GitHub PR, CI environment, public URLs, screenshots or ChatGPT.

**Current outcome: BLOCKED — REAL NATIVE PROVIDER / SAME-STORE AUTH / HOSTED NO-SEND CANARY NOT AUTHORIZED.** No change to existing production webhook endpoints or Messenger/Zalo reply behavior.

## 6. Rollback and checkpoint

New files and workflow live only on unmerged child Draft PR stacked on #369. Rollback by closing that child PR. **No** n8n, Supabase hosted, Meta, Zalo, Cloudflare, credential, billing, actual backup, live order, production config, Page subscription or provider send was touched.

Checkpoint: `V17.22G_PRIVATE_EVIDENCE_METADATA_CRYPTO_GATE_CANDIDATE · ONE_EVENT_OFFLINE_NOSEND_QA · SUPABASE_STORE_P0_BLOCKED · HOSTED_NO_GO`.
