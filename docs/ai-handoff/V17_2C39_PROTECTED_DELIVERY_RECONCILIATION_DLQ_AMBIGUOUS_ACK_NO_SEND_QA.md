# TIEN404 AI — V17.2C.39 Protected Delivery Reconciliation × Dead-Letter Queue × Provider Ambiguous-Acknowledgment No-Send QA

**Date:** 2026-11-18 JST. **Scope:** Draft PR #392, following V17.2C.38. **Budget/admission:** user-selected Option A — no paid Supabase branching/Pro, no hosted migration, no n8n publish, no customer Order write, no external message send or real credentials.
**V17.2C.38 verified baseline:** checkpoint HEAD `88d09f912572eae52a382172623cccc9131fbfb6`, ten committed synthetic events and no-send dispatcher queue and attempts.
**Tested code SHA:** `019b0941c8433163024c3a254b9339e0ba8bfae8`.

## 1. VERIFIED starting contract
- Actual previous CI-only `tien404_v172c37_outbox_qa.notification_outbox`: source events immutable `HELD_NO_SEND`, `can_send=false`, exact Store+Tenant+Order+Event identity.
- `tien404_v172c38_dispatch_qa.delivery_queue`: no recipient/transport/token, isolated Store/channel, retry states `READY_NO_SEND / RETRY_NO_SEND / PREVIEW_OK_NO_SEND / TERMINAL_NO_SEND`, up to three synthetic attempts.
- The V17.2C.38 temporary/ambiguous transient result previously allowed a retry after backoff, **without external evidence whether an actual provider received the message**. That is unsafe as a future production delivery assumption. V17.2C.39 adds a separate reconciliation guard in the isolated fixture.
- Real Supabase `public.orders` Store isolation and real Messenger/Zalo customer identity remain BLOCKED. This task did not read real order rows or provider messages. The Supabase organization remains Free; no new branch.

## 2. IMPLEMENTED — only on Draft PR #392 in ephemeral PostgreSQL 17
**Source files**
- `qa/v172c-rpc-closure/v172c39-provider-ambiguous-reconciliation-ci-only.sql`
- `qa/v172c-rpc-closure/v172c39-ambiguous-ack-dlq-ci-drill.sh`
- Existing CI `.github/workflows/v172c15-ephemeral-postgres-qa.yml` now runs the V17.2C.39 drill after V17.2C.38. Nothing deployed.

**Database design**
- A dedicated private `tien404_v172c39_reconcile_qa` schema with `private_gate`, `private_reviewers`, `private_proofs`, `reconciliation`, `proof_consumptions` and `dead_letters` fixtures. DB guard requires database `postgres` and existing synthetic V17.2C.38/37 schemas, and the shell requires localhost PostgreSQL 17 test connection. These files are NOT a Supabase production migration.
- Reconciliation states: `AMBIGUOUS_HELD`, `ACK_OBSERVED_HELD`, `RETRY_AUTHORIZED_NO_SEND`, `DLQ_HELD`. Every row enforces `can_send=false`.
- `BEFORE INSERT` on the **existing V17.2C.38 attempt ledger** rejects a new simulated attempt while the delivery is ambiguous/ACK-only/DLQ. This blocks even a direct caller of the previous dispatcher.
- `AFTER INSERT` on the same ledger automatically writes `AMBIGUOUS_HELD` when the simulated provider outcome is `SIMULATED_TRANSIENT_FAILURE`; both operations are in the same DB transaction so there is no post-timeout retry window. If a separate synthetic non-delivery proof previously released retry, another transient returns the delivery to held.
- `reconcile_private_proof(opaque_proof_ref)` loads a **private synthetic proof**, validates exact Store/tenant/channel/source event, active attested reviewer, issuer/signature/scope attestation flags and expiry, then atomically records proof use and changes state.
  - `ACK_OBSERVED_ONLY` means the provider acknowledgment signal was observed in simulation. It **does not** prove delivery to the recipient, and it continues holding retry.
  - `PROVEN_NONDELIVERY` with positive independently attested **synthetic** evidence is the only way to release a still-under-limit retry (`RETRY_AUTHORIZED_NO_SEND`).
  - `MANUAL_DLQ_REVIEW` requires valid attested review and elapsed review window; then transactionally creates one `dead_letters` row with a reason code and `DLQ_HELD`. DLQ cannot be resent automatically.
- The previous V17.2C.38 count-preview is replaced **only inside ephemeral CI** by a reconciliation-aware preview that omits held/ACK/DLQ rows. No scheduler or real dispatcher.
- All public/anon/authenticated grants explicitly revoked from the new private schema; functions are `SECURITY INVOKER` and contain no network calls, credentials, recipient IDs or external send fields.
- V17.2C.39 uses synthetic boolean proof flags for test contracts. This is **NOT actual cryptographic signature verification** and not evidence of provider receipt or consent. Nothing here allows promoting a source-only test to hosted UAT or production.

## 3. TESTED — GitHub CI
At tested code SHA `019b0941c8433163024c3a254b9339e0ba8bfae8`, all 3 GitHub Actions completed **SUCCESS**:
1. [Ephemeral PG17 Store A/B RLS, Order, V38 dispatcher + V39 ambiguous ACK/DLQ drill — #44248445519](https://github.com/ngoctien20/demo-git/actions/runs/44248445519)
2. [Protected Consent Source QA — #44248445630](https://github.com/ngoctien20/demo-git/actions/runs/44248445630)
3. [RPC Privilege Source QA — #44248445580](https://github.com/ngoctien20/demo-git/actions/runs/44248445580)

The new regression deliberately tests:
- Ambiguous provider simulation automatically creates a held row in the same transaction as attempt record; old V38 direct retry and V38 preview do not bypass quarantine.
- Provider ACK-only is not treated as `SENT`, `DELIVERED`, non-delivery evidence, or customer receipt.
- Negative source cases: incorrect signature flag, expired proof, unverifiable non-delivery, revoked private reviewer, forged cross-Store proof; all DENY.
- Failpoint `after_proof_ledger` and `after_reconciliation_state` fully ROLLBACK proof use and state. A later valid synthetic non-delivery proof permits a bounded retry; positive result is **PREVIEW only**, never a send.
- Premature manual review / unsigned review DENY. Failpoints `after_proof_ledger`, `after_reconciliation_state`, `after_dead_letter` fully rollback DLQ. Valid review creates a single DLQ row; replaying proof is idempotent; direct retry remains denied.
- Three uncertain synthetic attempts require two fresh, independently attested non-delivery proofs for attempts 2/3; after max attempt count, another proof cannot authorize further retry. A later signed synthetic review creates one `EXHAUSTED_RETRY_AMBIGUOUS` DLQ row.
- Attempt counters equal attempt rows; two expected DLQ entries are unique, every source event remains `HELD_NO_SEND`, all queue/attempt/reconciliation/DLQ rows enforce `can_send=false`. No real deliveries.
- Existing V17.2C.35–V17.2C.38 and tenancy/RLS baseline regression steps still PASS.

## 4. Release blocker and security interpretation
- **Real-world external delivery cannot be exactly-once guaranteed purely by database idempotency.** A timeout after provider acceptance may be indistinguishable from non-delivery; blindly retrying can duplicate a message. A real product needs provider-signed delivery/send receipts where available, independent reconciliation, stable provider correlation IDs, rate limits, human review and an ambiguous outcome policy. This CI only models the fail-closed admission logic.
- Do not treat a provider ACK as proof a customer **received/read** a message. Distinguish provider acceptance, attempted send, delivered, read, and recipient consent.
- The fake private-proof flags are not verified cryptography or independent data; the reviewer Store membership and route eligibility must be implemented with actual protected backend authority, current session and provider-specific verification.
- No actual outbox delivery adapter, Zalo/Meta bot auth, personal data encryption, hosted worker, background schedule or cross-channel customer link exists here.
- Actual Commerce `public.orders` still lacks Store-scoped authority and P1 #402/#403 remain OPEN. The legacy Google Sheets Demo path is separate and unchanged; real JWT A/B, backup/restore and independent reviewer admission remain NO-GO.
- Retry/backoff for real systems may incur messaging costs; no real delivery or provider API was called. GitHub Actions minutes may count toward existing CI quotas, but no new Supabase charge was intentionally initiated.

## 5. Status / checkpoint / rollback
- **VERIFIED:** PR still Draft; exact V38 source re-read; Supabase dev branch count 0 at start; 3 CI workflows SUCCESS at SHA above.
- **IMPLEMENTED:** V39 private reconciliation schema/guards/proof/DLQ preview and CI shell drill only.
- **TESTED:** ambiguous ACK quarantine, non-delivery proof gate, no-send retry, fake reviewer/Store negatives, failpoint rollback and DLQ idempotency PASS.
- **PROPOSED:** protected production delivery reconciler, provider-specific receipt verification and Store-permission design.
- **BLOCKED:** real provider receipt, hosted A/B JWT, actual Commerce Store-scoped schema, live Order Writer, publish and real message delivery.
- **ROLLBACK:** revert the V39 source, test and CI file commits or close Draft PR #392. Ephemeral GitHub Actions PostgreSQL is destroyed after run; no hosted database rollback.
- **Next priority recommendation:** return to P1 #402 canonical Store-scoped Orders/Auth and P1 #403 legacy writer isolation, rather than extend mock notification QA indefinitely.
