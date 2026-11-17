# TIEN404 AI — V17.4P P1 Replay Identity Invariance × Eviction Persistence Acceptance

**Date:** 2026-11-17 JST. **Linked security issue:** [#357](https://github.com/ngoctien20/demo-git/issues/357).
**Parent source:** Draft [PR #348](https://github.com/ngoctien20/demo-git/pull/348), exact baseline `6209d7f5c3c182b20b9ed22e22283fd68cd7b1c8`. Parent independently **810/810 PASS** (773 Node, 16 LOCAL Workerd, 21 local Chromium) at [CI #44092753729](https://github.com/ngoctien20/demo-git/actions/runs/44092753729).

## What the audit found
1. **Verified code-level replay-key weakness** in the local/cloud upload-candidate `V174PReplayGuard`: the original event key was `e:<expires_at>:<key>`. A changed caller-supplied `expires_at` could cause a second claim for the same `key` even inside the same local Durable Object, instead of treating it as a duplicate. The parent Worker signs session expiry, so direct exploitation of an external live endpoint has **not** been established. Nevertheless, the lower-level replay guard should independently reject this class.
2. The original [PR #344 CI attempt](https://github.com/ngoctien20/demo-git/actions/runs/44092860755) had an **intermittent LOCAL Workerd test failure**: after `evictDurableObject(stub)`, the previously claimed identity sometimes returned `claimed` rather than `duplicate`; a second attempt passed. This is **a reliability concern, not proven hosted vulnerability**.
3. Connected Cloudflare GET-only at **2026-11-17T14:02:37Z**: **31/31 Workers scripts, 3 existing protected DO namespaces** (V17.5 and Zalo parallel unchanged); both proposed V17.4P private QA issuer and private permit ledger still absent. `GET billing/spend-policies` and `GET billing/usage` each **403**. No user-approved monetary allocation beyond the historical screenshot with $0 recorded Nov 15–17. No Cloudflare write.

## Implemented source-only safeguard

Change in `qa/v174p-private-hosted/hosted-issuer.worker.mjs`:
- Add `k:<key>` **immutable identity index** to the local DO storage, independent of caller-provided expiry, storing the first fingerprint and original event expiry. The expiry-sorted `e:<expiry>:<key>` record is still kept to retain bounded alarm scanning.
- Claim transaction checks the identity index first and returns `duplicate` for same key/fingerprint or `conflict` for same key/different fingerprint even if expiry is shifted. Index + event persist atomically inside `storage.transaction`. Corrupt index/value causes fail-closed `503` behavior.
- Cleanup deletes an expired event and its identity index in one transaction **only when original expiry matches**, preventing accidental removal of a newer index or an index whose validity is uncertain.
- Existing session/message rate limits, no-send answer path and alarm batching remain. This patch does **not** change real Cloudflare, Meta, Zalo, Supabase, n8n or customer data.
- Source-only candidate is NOT production; check all other tool callers and independent Store RLS before any release.

Add regression tests in `qa/v174p-private-hosted/runtime/tests/replay.runtime.test.mjs`:
- Assert persisted `e:` and `k:` storage BEFORE and AFTER real local `evictDurableObject` and second request, distinguish storage loss from idempotency mismatch.
- Reject same key/fingerprint with shifted `expires_at` (`duplicate`) and changed fingerprint (`conflict`); event count must remain 1.
- Four consecutive eviction cycles preserve original identity and never permit a new claim.
- Alarm removes only an expired event, preserving a later, non-matching identity index.
- Existing 16-way concurrency, rate limits, alarm batch and negative claims retained.

## Acceptance and remaining risk

**At source commit time:** tests / CI results must be collected from exact HEAD; do not claim success from parent CI.

**GO** only for Draft/source local regression when all Node source, actual LOCAL Workerd SQLite and Chromium simulated Access tests pass. Prefer multiple **independent** clean CI attempts of the Workerd eviction suite without hiding failures behind single-job retries. Do not close P1 #357 until stability has been separately confirmed.

**NO-GO** for real hosted Private Ledger, Access/Billing changes, new paid Worker, uploads, real Merchant stores, Messenger/Zalo sends. Identity+Finance/budget blockers remain: Cloudflare Billing 403, Access MFA not verified, spend limit not inspected via authenticated Founder dashboard.

**Rollback:** Close/revert only this child Draft PR to previous independently green #348; no cloud rollback because only GET endpoints were used. This is an in-repository source candidate not deployed.
