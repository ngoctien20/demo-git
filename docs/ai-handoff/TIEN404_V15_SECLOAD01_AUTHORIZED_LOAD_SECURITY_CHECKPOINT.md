# TIEN404 AI — V15-SECLOAD-01
## Authorized Load Capacity × AI/Webhook Security × Multi-Tenant Resilience

**Ngày kiểm toán:** 2026-11-17 JST  
**Phạm vi:** Repo `ngoctien20/demo-git`; connected n8n, Supabase, Cloudflare Pages read-only; synthetic offline defensive QA only.  
**Không tự thực hiện:** production stress / unauthorized pen-test / Meta send / hosted migration / credential operations / real Orders / paid models.

### I. Trạng thái được VERIFIED qua kết nối thực tế

| Scope | Bằng chứng | Phân loại |
|---|---|---|
| GitHub checkpoint PR #235 | DRAFT OPEN HEAD `9446f4cdb9c4c10d64fa7264fa50d9b99bb0d055` | Source review |
| GitHub checkpoint PR #239 | DRAFT OPEN HEAD `fb4a85139acfdb3116dc44f4476eb70205f87855` | Source review |
| Prior PR #239 CI | [Actions #43901431570](https://github.com/ngoctien20/demo-git/actions/runs/43901431570) SUCCESS: 64 independent disposable PG17 connections (1 claim/63 conflict), 294/294 source regressions PASS | **NOT production concurrency** |
| n8n Messenger Published | `Z7FdV7uDvApfbURQ`, ACTIVE, `d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92`, 27 nodes, signed GET/POST webhook | Real live observation |
| Messenger Agent tool reachability | Existing Agent retains `create_order`, `manage_order`, `update_order_address`, `get_order_status`, `create_support_ticket`, plus Products read | **P1 source exposure**, not a proven exploit |
| Supabase staging | PG 17.11; `public.stores` and `store_memberships` both absent, no `store_id` on key Commerce tables, zero Store-qualified public RLS policies | **P0 STORE RELEASE GATE BLOCKED** |
| Supabase Security Advisor | 18 RLS-without-policy notices mainly private/QA schemas (may be intentionally deny-all); 1 anon and 2 authenticated PUBLIC `SECURITY DEFINER` functions | **P1 REVIEW**, not verified compromise |
| Cloudflare Pages | `tien404-ai-git-staging` and `tien404-ai-staging` found via connected account GET; one project points to `gh-pages` | Read-only listing, WAF unverified |
| Render | Workspace selection not yet user-confirmed; no direct service or log investigation | BLOCKED/NOT INSPECTED |
| AI SALES 96 + 36 datasets | CSV count checked locally: 96 single-turn `actual_output` empty; 36 multi-turn `NOT_RUN`; separate 97-line legacy CSV contains 96 unique case IDs and QA01 duplicate | **132 live model benchmark NOT RUN**, do not infer acceptance |

### II. Real historical Messenger performance — NOT a load test

Read-only `search_workflow_executions` returned **28 execution metadata** for Published Messenger; **25 were webhook-triggered SUCCESS with complete timing**, 1 manual success and 2 manual errors. Historical window **Nov 11–16 UTC**. Compute (t = stoppedAt-startedAt) per webhook execution; sort and use linear interpolation:

| Metric | Historical observed result |
|---|---:|
| Webhook execution wall-clock minimum | 59 ms |
| p50 | **9,081 ms** |
| p95 | **15,391 ms** |
| p99 | **16,305 ms** |
| maximum | 16,589 ms |
| N | 25 |
| historical webhook run success proportion | 25/25 in the available sample only |

**Caveats:** This is the elapsed lifetime of n8n executions, NOT HTTP handshake p95, AI node latency, Meta/Zalo delivery confirmation, business-correctness, throughput, stable RPS or guaranteed provider reply. The sample may mix GET handshake, signed message and rejected/retry paths, and is far too small/uncontrolled for load-capacity claims. Actual production RPS, p95 for a genuine delivered reply, number of simultaneous customers, rate-limit 429/5xx, model cost and queue depth remain **NOT MEASURED**.

### III. Attack-surface and trust boundary

```text
Public Website / Messenger / Zalo
      [UNTRUSTED client, prompt, webhook payload]
                  │
       Auth + native webhook HMAC validation
                  │
        replay / signed provider identity
                  │
     server-side Page/OA→Tenant→Store authority
                  │
       tenant- AND store-scoped JWT/RLS
                  │
    catalog/price/stock/order business tools
                  │
      transaction / idempotency / outbox
                  │
       approved one provider reply path
```

**Critical P0 gate:** The real hosted canonical Store & Store-level RLS for Commerce are not yet independently deployed. Prototype QA tenant resolvers must not be promoted as real Store isolation.

| Risk ID | Finding | Severity classification | Evidence certainty | Restriction |
|---|---|---|---|---|
| SEC-P0-01 | Missing hosted canonical Store and Store-scoped RLS for multi-shop Commerce | **P0 RELEASE BLOCKER** | VERIFIED absence; **no exploit proved** | No Commerce multi-store release |
| SEC-P1-01 | `public.qa_shop_b_zalo_claim` SECURITY DEFINER callable by `anon` | P1 HIGH-PRIORITY REVIEW | VERIFIED role metadata + Advisor; guard may exist | Privileged read-only code/Grant review, not exploit |
| SEC-P1-02 | `public.qa_owner_pairing`, `public.save_merchant_product` SECURITY DEFINER callable by `authenticated` | P1 HIGH-PRIORITY REVIEW | VERIFIED metadata, no BOLA proof | Check server-side owner check, SEARCH PATH, GRANT and tenant scope |
| SEC-P1-03 | Live Messenger Agent exposes five legacy toolWorkflow capabilities | P1 DESIGN RISK / PROOF PENDING | VERIFIED attachment; invocation authorization not tested here | Do not promote to write-capable multi-store Core |
| SEC-P1-04 | No hosted shared durable one-shot claim RPC and no independent full n8n restore | P1 release/resilience blocker | VERIFIED hosted absence + checkpoint | LIVE02 NO-GO |
| SEC-P1-05 | Public rate limiting, payload budget and signed identity resolver across channels unverified | P1 UNVERIFIED CONTROL | NOT TESTED | Do not run attack-load against production |
| SEC-P2-01 | 18 RLS-without-policy Advisor notices in mostly private/QA schemas | P2 VERIFY INTENDED DENY-ALL | VERIFIED existence, not demonstrated weakness | Classify per schema/exposure; no blanket GRANT |
| SEC-P2-02 | Credential/PII log retention, session leakage, subscription expiry and frontend BOLA not audited end-to-end | P2 OPEN AUDIT | NOT TESTED | Read-only code review + disposable fixtures first |

**Strict distinction:** A security-advisor warning is not proof of exploitation; a synthetic defense PASS is not proof the live code enforces it. No production penetration testing or unauthorized third-party infrastructure scan has been performed.

### IV. Bounded synthetic capacity/security QA — scope and acceptance

New source suite `qa/v15-secload01/` defines:
- A purely synthetic HMAC webhook, server-only Page→Tenant→Store resolver, isolated product pricing, memory/session keys, server-issued order permits, idempotent fake order/outbox, tenant-scoped rate simulation and fail-closed mocked model.
- **L1=1, L2=5, L3=10, L4=25, L5=50, L6=100 simulated conversations**; total **600 synthetic requests**. Each request invokes *in-process mock* signature/route, price and fake model (nominal 9 ms delay). Outputs measured mock p50/p95/p99 latency, queue wait, synthetic throughput and errors. It **never sends** requests to n8n, Meta, Supabase or real AI models.
- Security tests: HMAC tampering, invalid signature, replay, client-forged role/store, cross-Shop same tenant and cross-Tenant access, rejected prompt-induced order, server-issued tool permission, mismatched price/stock, unique order/outbox and one-store rate isolation, simulated model failure.
- GitHub CI `.github/workflows/v15-secload01-offline-load-security-nosend.yml` outputs an attached JSON artifact named **OFFLINE-SYNTHETIC-NOT-PRODUCTION**. Metric labels deliberately contain `internalMockRps` and `actualProductionRps:null`.
- Existing 294 no-send/atomic/recovery/identity tests re-run in a separate CI job. **Do not mark new suite PASS until exact commit CI is inspected.**
- Real L7–L10 (multi-store hosted, actual retry provider, actual AI timeout, backend outage) are **NOT RUN** on production; synthetic negative cases exercise individual invariants only.

### V. Capacity planning model, explicitly hypothetical

Planning variables (not measured traffic): (C=) shop count, (H=) conversations per shop per hour, (M=) messages per conversation; expected peak (RPS=C H M / 3600 	imes P), with peak factor (P).

**Illustrative-only assumptions**: `H=20 chats/shop/hour`, `M=4 messages/chat`, `P=5` (peak multiplier). Actual merchant demand, provider limits and n8n concurrent capacity are unknown.

| Shops | Assumed base requests/hour | Hypothetical peak RPS | Live verification |
|---:|---:|---:|---|
| 1 | 80 | 0.11 | NOT TESTED |
| 3 | 240 | 0.33 | NOT TESTED |
| 10 | 800 | 1.11 | NOT TESTED |
| 50 | 4,000 | 5.56 | NOT TESTED |
| 100 | 8,000 | 11.11 | NOT TESTED |

A real system throughput must be tested separately for webhook ack, full AI, tool interaction, backlog, Meta/Zalo delivery and cost. The mock RPS obtained in Node CI **must not** be substituted into this capacity model.

### VI. Acceptance gates, approvals, checkpoint

1. **NEXT P0:** Independent Store ownership, hosted JWT/RLS read-only verification and resolution of privileged RPC authority; draft least-privilege fixes with operator review. Never grant PUBLIC access to resolve errors.
2. **NEXT PERFORMANCE:** Resolve permitted isolated staging n8n quota and mock provider budget, then record a baseline at 1–10 *synthetic* concurrent requests in an Inactive workflow. Do not hit public webhook or send Meta/Zalo in this gate.
3. **NEXT PRIVACY:** Verify client and Agent tools read-only security, message size/rate, replay at one Page/OA, tenant/store session keys and outbox idempotency with a disposable database.
4. **NEXT BACKUP:** Independent full encrypted n8n export, credential-reference inventory and disposable restore proof. Previous history-only or partial Auth/Storage export is not service recovery.
5. **NEXT APPROVAL:** LIVE02 remains NO-GO until native Page/QA recipient, deployed durable one-shot, exact no-writer patch, backup/restore, independent review and specific one-send signoff.
6. **FINANCIAL:** No real model/provider call, no charge-cap release; per-1000 model request cost and the actual n8n Cloud plan quota must be separately verified before rate projections or budget certification.

**Permissions used:** read-only actual systems; additive GitHub Draft branch, GitHub synthetic CI. No secret disclosure, no live role/credential edits, no hosted SQL DDL, no customer data mutation, no Published changes or provider sends.

**Release decision:** `V15-SECLOAD-01 = NO_GO_FOR_LOAD_CAPACITY_CERTIFICATION_AND_MULTI_STORE_PRODUCTION`.  
**Rollback:** close the child Draft PR; no n8n/hosted/Meta rollback necessary because unchanged.

**Next checkpoint:** `V15-SECLOAD-02 — Hosted Store Ownership Proof × Privileged RPC Security Review × Bounded Staging Concurrency Metrics`.
