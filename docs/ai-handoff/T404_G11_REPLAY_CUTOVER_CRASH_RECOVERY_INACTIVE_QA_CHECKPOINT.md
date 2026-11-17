# TIEN404 AI — G0.11 Replay Cutover Design × Crash Recovery × Inactive End-to-End QA

**Verified:** 2026-11-17 JST  
**Lifecycle:** IMPLEMENTED SOURCE / TESTED Node22 + DISPOSABLE PG17 + n8n INACTIVE / PRODUCTION NO-GO  
**Draft:** [PR #275](https://github.com/ngoctien20/demo-git/pull/275), child of G0.10 PR #272, base SHA \`ef759a692551ddcc041a66b1fba00466d715dff5\`.  
**Checkpoint:** \`G11_REAL_SIGNED_SHADOW_REUSED__PG17_24_LEASE_SERIALIZATION_PASS__N8N_4542_30_OF_30_PASS__LIVE_CUTOVER_NO_GO\`.

## 1. What was independently VERIFIED before any new writes

Baseline connected n8n Published versions at G0.11 audit start. **This baseline was superseded by a separate parallel V17.15 release during G0.11; see section 7**:
- Messenger DEMO \`Z7FdV7uDvApfbURQ\` at \`ff7a57d2-519a-4283-933c-37a854df92d2\`. Real signed webhook \`4431\` verifies Meta HMAC; **legacy AI Sales bot ran and Meta accepted one reply**.
- Private Messenger→Core Shadow \`dw1JOxWOEY8csTnm\` at \`450f2693-aad9-47d8-aaba-ac7a94abe644\`. Real derived \`4432\`: private PII-minimized receipt, 0 **Shadow** sends, 0 Order writes, 0 model calls.
- Central Commerce Core \`iyfGUiEsZlNTBWOR\` at \`ddc3ce5b-365e-47e2-a06d-08daffceb9a8\`. Nested real \`4433\`: rejects deliberate unknown Store, no positive Store authorization.
- **Existing concurrency risk to solve**: Published Messenger \`Skip Duplicate Message ID\` Data Table operation \`rowNotExists\` occurs before provider Send, then a separate \`Record Successful Messenger MID\` node writes after success. This check/record gap does NOT prove atomic exclusion under two simultaneous valid deliveries. **Potential race only; no production duplicate Send was demonstrated or provoked.**

No real customer body, PSID, Page ID, webhook HMAC, Meta credential, phone or order data was copied into this G0.11 work. Existing legacy Messenger and Shadow are not switched to any new deduplication system.

## 2. The new bounded state machine (DISPOSABLE PG17 only)

\`\`\`text
             verified synthetic inbound + durable claim
                              |
                         READY (unique)
                              |
                    ACQUIRE [atomic lock]
                              |
                 LEASED (fenced UUID token)
                   /                   \\
           no-send path          FUTURE outbound boundary
               |                          |
        COMPLETE_NO_SEND            SEND_UNCERTAIN
               |                          |
         DONE_NO_SEND          MANUAL REVIEW REQUIRED
                                      |
                             NO AUTOMATIC SEND RETRY
\`\`\`

**Crash before any send/no-send completion:** row remains \`LEASED\`. Retry *before lease expiry* returns \`leased\` (in-progress) and MUST NOT start another side effect. After expiry, another worker gets \`reclaimed\` with a different fenced token. Stale worker cannot finalize. Once verified No-Send is durably completed, duplicate returns \`done\`.

**Crash before/after a possible provider Send:** the design has an explicit \`SEND_UNCERTAIN\` barrier. Once an outbound attempt may have been started, automatic re-sending would risk double messaging. Persist uncertainty *before* crossing outbound side-effect boundary; retained row is visible for operator/provider reconciliation. No automatic replay of \`SEND_UNCERTAIN\`, including after lease expiry. G0.11 does NOT contain a provider sender.

**Avoiding silent loss:** a row is never deleted because the worker stopped; \`LEASED\` with expired TTL is recoverable, \`SEND_UNCERTAIN\` is retained until separately reconciled. This is a *reference contract*: actual durable retry scheduler, 24/7 monitoring, operator queue/UI, protected data retention, key rotation, provider message reconciliation, and hosted observability are **not deployed**. The contract **does not prove exactly-once customer delivery or guarantee that no reply is missed**.

**Data minimization:** \`provider + HMAC(installation) + HMAC(event receipt) + HMAC(raw payload)\`, with secret distinct from App Secret, no actual Page/MID/PSID/body/customer fields. Private non-Data-API schema; non-SECURITY-DEFINER claim, row security flag and no PUBLIC privileges. The disposable scripts are **not approved hosted migrations**, and default administrative test role is NOT a production least-privilege role design.

## 3. IMPLEMENTED artifacts and actual test surfaces

### Source and ephemeral PostgreSQL

- \`qa/v152-g11/disposable-pg17/01_lease_ledger.sql\`: privately scoped table and \`acquire_nosend\`, \`complete_nosend\`, \`mark_send_uncertain\` **Postgres 17** functions. Row-level lock, UUID fencing, payload conflict, lease expiry/renewal, done and manual review.
- \`02_crash_recovery_assert.sql\`: deterministic SQL clock tests for stale-worker fencing, post-crash reclaim, uncertainty held after 180 minutes, wrong provider/digest/lease blocked, no PII fields, privileges.
- \`03_parallel_24_leases.sh\`: 24 actual distinct PG backend sessions concurrently compete to lease one synthetic event; then winner completes No-Send and the row must return \`done\`; changed payload must return \`conflict\`.
- \`qa/v152-g11/fenced-nosend-lease-adapter.cjs\`: pure dependency-injected private repository adapter. Calls the real **pinned V17.1E** Meta \`handleIsolatedMeta\` export supplied by G0.9, after independent private authority controls; never forks raw HMAC. Only returns signed QA No-Send success **after repository \`completeNoSend\` returns \`completed\`**. If DB acquire/complete fails, unknown status, stale token or bad HMAC → blocked HTTP 503, not a false success. It has **no direct n8n, Supabase, Meta, network or credential access**.
- \`qa/v152-g11/fenced-nosend-lease-adapter.test.cjs\`: 30 Node22 synthetic tests using the actual pinned V17.1E source plus fake in-memory shared ledger for timing and crash scenarios. The in-memory test does NOT prove PG17; separate CI PG17 job does.

### Real Inactive n8n QA

- Workflow [TIEN404_G11_CRASH_RECOVERY_INACTIVE_END_TO_END_QA_NO_SEND](https://ngoctien20.app.n8n.cloud/workflow/8rVwGfA88dUqDPCI)
- ID \`8rVwGfA88dUqDPCI\`; n8n Personal \`WW82YsCCaAxGC9dp\`, \`90_QA - DIAGNOSTICS\`.
- Actual draft version \`9208bfec-abc6-476c-af52-ad5f2d0f5dd6\`, inspected: \`active=false\`, \`activeVersionId=null\`, **4 nodes: manual trigger + 3 Code**, no credentials, webhook, HTTP, Data Table, Postgres, Supabase, AI, Commerce reader, or Sender; no saved pin data.
- SDK source \`qa/v152-g11/INACTIVE_N8N_CRASH_RECOVERY_SDK.js\` validated using n8n Workflow SDK and executed on n8n Cloud.
- This is a **30-step actual n8n runtime simulation** of lease/fencing/expiry/no-send/unreconciled send; it is NOT a live Meta callback and does NOT connect to PostgreSQL. **Actual PostgreSQL crash/atomic behavior is tested separately in disposable CI**.
- \`INACTIVE_N8N_CRASH_RECOVERY_SDK.test.cjs\`: 18 Node VM source tests, including false real-DB claim, fake provider, unexpected Shop, illegal Send, dropped review row.

## 4. VERIFIED acceptance results

### Exact pre-document source Actions CI

[Run #44017953244](https://github.com/ngoctien20/demo-git/actions/runs/44017953244), source SHA \`06ad192976189b470ea816a12bc635897d9c3ecb\`:

- Completed **SUCCESS / 3 of 3 jobs**.
- **Node22: 387/387 PASS**, independently inspected logs: **30 new G0.11 pinned Meta/lease** + **18 new n8n source** + **50 V17.1E actual pinned Meta handler** + **289 inherited G0.4–G0.10 = 387**, 0 fail.
- PG17 disposable CI service: actual **24 independent DB sessions ⇒ 1 claimed, 23 leased, exactly 1 ledger row**; complete ⇒ \`done\`, changed payload ⇒ \`conflict\`.
- PG17 deterministic crash test **PASS**: expired no-send lease reclaim, old lease fencing, different installation separation, no false completed after uncertain send.
- PG17 RLS/invoker/no-PII/untrusted role tests PASS. Independent "no live publish/hosted migration" job PASS, meaning **release was correctly refused**, not allowed.
- No Supabase hosted, n8n Published, provider credential or customer data used during PG tests.

### Actual n8n executions

- \`4507\`: SUCCESS **30/30**, six synthetic event keys, 5 \`DONE_NO_SEND\`, 1 \`SEND_UNCERTAIN\` (review needed), no provider sends/Orders/Commerce reads/models.
- \`4539\`: ERROR **by design**, temporary synthetic pin turned first event's \`signatureOk=false\`; final acceptance refused \`G11_FAILED_CASE_QA_G11_01\`.
- \`4541\`: ERROR **by design**, temporary pin asserted \`database_used=true\`; input refused \`G11_UNTRUSTED_QA_SOURCE\`. This proves the QA cannot falsely claim PG17 integration.
- \`4542\`: FINAL CLEAN SUCCESS **30/30**, 0 provider sends/Order writes/Commerce reads/model calls, \`can_publish=false\`, live cutover \`NO_GO\`.
- Re-read workflow after 4542: **Inactive**, 0 credential/external IO nodes, 0 stored pinData.

All pin-only negatives are ephemeral inputs, NOT persistent Data Table writes.

## 5. Remaining blockers, owner approval, planned rollback

**BLOCKED:**
- No production shared-DB lease ledger, no real Messenger MID replay across concurrent provider callbacks.
- No provider-side message delivery idempotency proof or safe reconciliation of uncertain outbound Send. A "claimed" inbound event alone cannot guarantee a reply was delivered.
- No original independent Merchant→Store owner attestation, Supabase same-Tenant Store JWT/RLS and current independent restore. Local-machine backup was **deferred by Owner**, which does not waive hosted migration recovery gate.
- No separate QA Meta Page/App owner-proof accepted; the existing verified real event originated from **legacy Messenger DEMO** and its old reply was sent. New Shadow branch alone was No-Send.
- No Zalo OA native signed callback acceptance or cross-channel customer identity challenge.

**Separate approval needed before any risky action:** create persistent hosted replay schema, attach DB credential, migrate current \`rowNotExists\` check to atomic claim **before** send/Shadow, change Send error handling or n8n Published version, alter Meta callback, test real duplicate webhook, read actual customer Orders or create outbound reconciliation. Each requires snapshot, Operator/Reviewer approval, test evidence and rollback. The G0.11 implementation is **not** that approval.

**Rollback now:** Leave new G0.11 workflow Inactive and close Draft PR #275 if unwanted; no live deployment or production data affected. Do not remove QA workflow/tables without explicit cleanup authorization. G0.11 did not modify any Published workflow. **Do not use the old versions in section 1 as current rollback targets**; consult the newer V17.15 version evidence in section 7 and re-audit live state first.

## 6. Merchant-facing operational simplicity

Store owners are not asked to back up databases, manage keys or understand leases. Future customer dashboard/operator console should show simple statuses **Đang xử lý / Hoàn tất / Cần nhân viên kiểm tra**. TIEN404's internal operator monitors \`SEND_UNCERTAIN\` and resolves possible duplicated/missing provider replies; no blind retry. Admin should not falsely mark an Order or response delivered from event ACK alone.

**Next proposed G0.12:** Shadow Replay Operator Queue × Lease Timeout Reconciliation × Restricted Pilot Acceptance. Source-only/private operator QA first; no live cutover without explicit owner approval.

## 7. IMPORTANT — Parallel V17.15 release detected during G0.11 (read-only re-audit)

After source and n8n G0.11 QA, a final read-only n8n version check detected concurrent changes from the separate V17.15 integration team. **Do not claim Published Messenger/Core were unchanged across the entire G0.11 time window. G0.11 itself made no Published edits.**

- Messenger `Z7FdV7uDvApfbURQ`: **current Published `2b869035-fe39-46fb-a253-18fefe4ecbfd`**, 32 nodes. It has new opt-in `QA_CORE:` sample-only Core consultation plus the existing single Meta Send. **The earlier `rowNotExists` duplicate check and later `Record Successful Messenger MID` remain present**, so the potential concurrent check-then-record race is NOT resolved by V17.15.
- Central Core `iyfGUiEsZlNTBWOR`: **current Published `3d3905a4-0d26-4253-8a1d-57fd73b043c2`**, 18 nodes, new read-only DEMO catalog route and restricted internal caller allowlist. **Not a verified merchant Store/JWT/RLS Commerce service.**
- Private restricted Shadow `dw1JOxWOEY8csTnm`: remains Published `450f2693-aad9-47d8-aaba-ac7a94abe644`.
- G0.11 Inactive QA `8rVwGfA88dUqDPCI`: remains Inactive, draft version `9208bfec-abc6-476c-af52-ad5f2d0f5dd6`, 0 credentials, 0 external I/O, no saved pinData.
- New actual Messenger GET negative `4538` is not a positive signed `QA_CORE:` POST. V17.15 original source report explicitly identifies the positive signed QA_CORE post-response as PENDING; earlier one-event signed `4431` predates V17.15. **No G0.11 real replay or post-V17.15 signed positive validation was performed.**
- Parallel source checkpoint: [V17.15 Messenger Core DEMO Consult × Zalo/Web Shadow](https://github.com/ngoctien20/demo-git/blob/work/v171a-channel-store-bot-vertical-slice-nosend-20261117/docs/ai-handoff/V17_15_MESSENGER_CORE_DEMO_CONSULT_ZALO_WEB_SHADOW_CHECKPOINT.md). Zalo Bot staging and Website demo have separate protected Core-deny probes; G0.11 does not change them.

**Revised rollback rule:** Before any future live replay change or rollback, re-read active Published versions, capture new V17.15 graph/branch pre-change snapshot and obtain explicit owner approval. Do not republish `ff7a57d2...` or older Messenger/Core versions automatically; this would risk removing the concurrently deployed V17.15 features.
