# TIEN404 AI — G0.12 Replay Operator Queue × Timeout Reconciliation × Restricted Pilot Acceptance

**Checkpoint:** 2026-11-17 JST.  
**Lifecycle:** IMPLEMENTED / TESTED IN DISPOSABLE PG17 + INACTIVE n8n / LIVE NO-GO.  
**PR:** [G0.12 Draft #278](https://github.com/ngoctien20/demo-git/pull/278), child of G0.11 Draft #275 pinned base SHA \`3594ba1b3ebf222dda2c6c72521531bb7339f6aa\`.  
**Scope:** protect safe retry/reconciliation for operator staff, not a real merchant-facing delivery service, not a live Messenger switch.

## 1. What was verified first — actual n8n Published state

Connected n8n inspected before G0.12 writes:
- Messenger DEMO \`Z7FdV7uDvApfbURQ\` **Published \`2b869035-fe39-46fb-a253-18fefe4ecbfd\`**, retains original Data Table \`rowNotExists\` MID check, provider Send node and later \`Record Successful Messenger MID\`. Its new opt-in \`QA_CORE:\` DEMO-only consultation is from parallel V17.15; G0.12 **did not modify any of it**.
- Private Messenger Shadow \`dw1JOxWOEY8csTnm\` **Published \`450f2693-aad9-47d8-aaba-ac7a94abe644\`**, still internal No-Send.
- Central Core \`iyfGUiEsZlNTBWOR\` initial V17.15 version \`3d3905a4-0d26-4253-8a1d-57fd73b043c2\`; **after this G0.12 work a concurrent team updated it to \`b08f806b-25dc-40d4-9e82-212307ce19b9\`**, still Published, 18 nodes. The caller allowlist still includes Messenger and private bridges. G0.12 did NOT change it; avoid stale rollback of parallel V17 features.
- Real signed Meta POST \`4431\` with private Shadow \`4432\` and central Core denial \`4433\` remains a verified historical ingress chain **before V17.15**, not a post-release QA_CORE signed/Store-scoped positive path. Legacy DEMO did send a reply; private Shadow produced no Sends.
- G0.11 disposable PostgreSQL 17 had proven one atomic claim under 24 competing connections and fenced no-send crash recovery. **No production replay claim has yet replaced the Messenger rowNotExists→later-record design**.

No real Page ID, PSID, MID, order, customer, credential, signed payload, phone or stock data was used for G0.12.

## 2. IMPLEMENTED — private operator queue contract (disposable PostgreSQL 17 ONLY)

Added \`qa/v152-g12/disposable-pg17/01_operator_queue.sql\` on top of the **disposable G0.11 lease-ledger source** \`qa/v152-g11/disposable-pg17/01_lease_ledger.sql\`.

- A **single review case per (provider, HMAC installation digest, HMAC event digest)** with foreign key to original G0.11 event ledger; no raw event IDs or customer data.
- A **bounded \`enqueue_timeout_and_uncertain\` scanner** (1–100 records per scan): automatically *enqueues a review case only*, for expired \`LEASED\` or \`SEND_UNCERTAIN\`. Repeated scans are idempotent, and never call Meta, model, Orders, merchant catalog or an automatic retry.
- **Fenced Operator ownership**: a private actor tag can claim one \`OPEN\` case; another Operator sees \`busy\`. After reviewer lease expiry a different Operator can claim with a new UUID fence; stale worker cannot submit proof.
- **Reviewer gate:** Operator submits a 32-byte evidence commitment and category; a distinct reviewer-role tag checks exactly the same digest before marking the *review case only* as \`RESOLVED\`. For \`SEND_UNCERTAIN\`, a provider receipt type is mandatory; treating it as ordinary \`NO_SEND_CLOSED\` is denied. **The original G0.11 \`SEND_UNCERTAIN\` stays blocked even when the review case is RESOLVED.**
- Review history captures \`QUEUED / CLAIMED / CLAIM_EXPIRED_REPLACED / EVIDENCE_SUBMITTED / INDEPENDENT_REVIEWED\`. A trigger denies ordinary \`UPDATE\` / \`DELETE\` on this history, verified with actual PG17 tests. **Not tamper-proof against a privileged DBA or schema owner.**
- Private non-exposed schemas, no PUBLIC privileges, RLS defense in depth, \`SECURITY INVOKER\` functions only. **Synthetic** QA operator tags like \`qaop_agent_a\` and reviewer tags like \`qarev_agent_b\` are not real SSO identities, and SQL role-label comparisons do not establish true independent human reviewers or ownership. A future live deployment requires separately authenticated principal IDs and RBAC enforcement outside public client-supplied strings.
- Evidence hashes in QA are invented commitments, **NOT originals independently inspected by a real reviewer**. Real Provider/Store proof remains blocked.

Other G0.12 source files:
- \`02_assert_operator_queue.sql\` — deterministic case timeout/worker-crash/fencing, evidence and second-party cosign, provider receipt gate, no-send boundary, audit immutability tests and untrusted role deny. Uses invented digests and synthetic timestamps.
- \`03_operator_24_workers.sh\` — **24 independent real disposable PostgreSQL sessions** race one private case and assert **1 claimed / 23 busy / exactly one case**.
- \`qa/v152-g12/operator-queue-preview.cjs\`, \`.test.cjs\` (14 offline Node22 tests) — small internal-facing Vietnamese, PII-free, synthetic-only status preview:

| Internal stage | Suggested staff label | Automatic provider send? |
| --- | --- | --- |
| OPEN | Cần nhân sự kiểm tra | No |
| IN_REVIEW | Đang kiểm tra | No |
| WAITING_COSIGN | Chờ xác minh độc lập | No |
| RESOLVED | Đã ghi nhận đối soát | No; **reviewed ≠ delivered** |

**Business UX:** Owners of small shops are not expected to understand databases, leases, secrets or backups. These are internal TIEN404 operator responsibilities. A merchant-friendly UI could eventually show \`Đang xử lý / Cần nhân viên kiểm tra / Đã đối soát\`, but **no real customer/staff Dashboard was deployed in G0.12**.

## 3. TESTED — independent actual GitHub Actions (CI service, never hosted Supabase)

Initial source-only CI [#44021417460](https://github.com/ngoctien20/demo-git/actions/runs/44021417460) passed **401/401 Node22 tests and actual PG17 queue assertions** before the append-only trigger addition.

A subsequent CI run [#44021932820](https://github.com/ngoctien20/demo-git/actions/runs/44021932820) detected a **trigger PL/pgSQL dollar-quote formatting error** after adding the audit-history hardening. It was fixed with a **named \`$g12_hist$\` PL/pgSQL delimiter**, and tested again. Do not hide the failed intermediate run or claim it was successful.

[Current verified source CI #44022096706](https://github.com/ngoctien20/demo-git/actions/runs/44022096706), on source SHA \`ff41bd1abcab20baa3ac0de091b3ede0dd425521\`:
- **COMPLETED SUCCESS, 3/3 jobs**.
- **Node22 420/420 PASS, 0 failures:** 14 new operator-view + 19 n8n QA source VM + 50 pinned original Meta V17.1E + 337 inherited G0.4–G0.11 = **420**.
- **PostgreSQL 17 disposable service: PASS:** 2 real SQL review cases correctly queued (timeout + uncertain), repeat scan created **0 duplicates**; Operator lease timeout replacement prevented stale submission; wrong document hash denied; separate Reviewer cosign accepted synthetic matching evidence; \`SEND_UNCERTAIN\` remains blocked in **original G0.11 ledger** even after case reconciliation.
- **Actual 24 independent PG17 backend sessions:** exactly **1 claimed / 23 busy / 1 review case**.
- Append-only review history SQL tests: normal UPDATE/DELETE denied; private queue functions were not exposed to an unauthorized test role; no PII fields or SECURITY DEFINER.
- The third CI gate deliberately **refused production promotion**; its green outcome is not real operator/Store/Page clearance.

**Limit:** Real PG17 was disposable GitHub Actions CI. No durable hosted operator queue, no real employee SSO, no real customer webhook replay, and no actual external provider receipt inspected.

## 4. TESTED — real Inactive n8n Manual QA (NO DATABASE/PROVIDER)

[TIEN404_G12_OPERATOR_REVIEW_INACTIVE_QA_NO_SEND](https://ngoctien20.app.n8n.cloud/workflow/um4Xfn0crIQgMosl)
- ID \`um4Xfn0crIQgMosl\`, n8n Personal / \`90_QA - DIAGNOSTICS\`.
- Draft version \`195f3205-9a33-4bb8-97a9-0a2068a9cc03\`, final inspected **\`active=false\`, \`activeVersionId=null\`**, **four nodes = Manual + 3 Code**, **0 credentials, 0 external I/O nodes, 0 persisted pinData**.
- Exact Workflow SDK in \`qa/v152-g12/INACTIVE_OPERATOR_QUEUE_N8N_SDK.js\` validated and authored on connected n8n, with **19 Node VM tests** verifying source and deliberate negative mutations.
- Execution \`4736\` **SUCCESS 26/26** synthetic operator cases: 3 synthetic cases, all marked *reviewed* in simulation, one original \`SEND_UNCERTAIN\` preserved, 0 provider Sends/Orders/Commerce reads/models. The simulation never queries PostgreSQL and does not authenticate real reviewers.
- \`4737\` **ERROR BY DESIGN**: temporary pin faked \`actual_db_access=true\`; rejected \`G12_QA_SOURCE_UNTRUSTED\`.
- \`4738\` **ERROR BY DESIGN**: pinned review evidence changed to trick the negative case; rejected \`G12_CASE_FAILED_QA_G12_08\`.
- \`4739\` **FINAL CLEAN SUCCESS 26/26**, 0 provider sends, 0 Orders, 0 Commerce reads, 0 model calls, \`can_publish=false\`, \`cutover_status=HOSTED_NO_GO\`; no saved pinData.

## 5. REQUIRED for any Restricted Real Pilot

**MUST NOT pretend the QA-only reviewer strings are real credentialed employees**. Before pilot on a real channel:
1. **Private authority:** Named production Operator and different Reviewer authenticated through TIEN404 admin SSO or internal IdP; strict server-enforced RBAC, cross-tenant Store scoping and store membership; unauthorized staff must never see another store's queue.
2. **Primary source:** Real merchant/Page/OA owner and store installation authority, provider-origin authenticity proof and tamper-evident sealed source receipt; no tokens, PII, message contents or raw IDs in GitHub logs/ChatGPT. Technical HMAC does not prove original merchant Store ownership.
3. **Replay storage:** Approved private hosted schema+restricted per-store credentials, monitored durable queues, shared atomic lease store, safe replay-pepper rotation, retention & deletion policy, resource quotas and incident recovery. **Do NOT copy disposable CI SQL directly into Supabase hosted.**
4. **Manual review policy:** External signed provider receipt, evidence provenance, reviewer independence, authorized dispute/close semantics; \`SEND_UNCERTAIN\` **never** auto-retries based on a support worker clicking a button. Provider-side idempotency/delivery lookup may be required.
5. **Pilot scope:** Separately authorized QA App/Page or owner-approved isolated real signed No-Send inbound, limited to one consenting test sender and a bounded window. Shadow No-Send first; no customer Orders, Stock, Billing, model, public callback or production message sends.
6. **Release plan:** Snapshot actual latest Messenger/Shadow/Core versions, independent current hosted recovery acceptance, negative multi-tenant Store JWT/RLS tests, explicit Owner approval, one-event canary, rollback and post-cutover monitoring. Failure closes pilot without silent resends.

**BLOCKED:** real provider callback into new operator queue, real owner-certified Page/Store, actual Operator/Reviewer SSO authorization, Store-qualified JWT/RLS, current independent hosted restore, production MID pre-send replacement, customer-facing delivery confirmation and multi-channel Zalo OA native verification. The Owner previously deferred **local-machine backup**; that does not certify hosted restore or authorize hosted DDL.

## 6. Practical next recommendation & rollback

**No live changes** were made to Messenger, Zalo, Website, Shadow or Central Core; G0.12 changed only new Draft repo source/CI/doc plus an isolated Manual-only Inactive n8n workflow. Existing Published versions may change concurrently in V17; re-read before any cutover, **never restore older workflows without checking new features**.

Rollback for G0.12: close Draft PR #278 and leave n8n QA workflow Inactive for regression. Delete QA resources only with separate approval. Disposable Postgres service is destroyed after CI. No production data rollback required.

**Checkpoint:** \`G12_420_NODE22_PASS__PG17_OPERATOR_24_RACE_PASS__N8N_4739_26_OF_26_PASS__REAL_OPERATOR_SSO_AND_LIVE_NO_GO\`.
