# TIEN404 AI — V18.5.2 Published Core Read-Only Admission × Exact Tool Allowlist

**2026-11-18 JST · CANDIDATE → SOURCE-ONLY TESTED · HOSTED/PRODUCTION NO-GO.**

Parent V18.5.1: Draft PR #404, base HEAD `31d913f2491cd470d8182c575a9e2a5fe9f80fa5`. This phase: **stacked Draft PR #405**, no merge to #404 or production.

## 1. VERIFIED — independently read current n8n Published/Draft (without executing)

| Workflow | ID | Published version | Risk |
| --- | --- | --- | --- |
| Shared Commerce Sandbox AI Core | `iyfGUiEsZlNTBWOR` | `456862c9-e5ee-4bfa-9931-47dbc39ab73d` | **NOT READ-ONLY:** published Agent exposes `Create Sandbox Ticket` as an AI tool |
| Commerce support ticket tool | `jirkuVts1AjIhnPJ` | `d7d1d80d-38f3-49cd-8290-6930072cc231` | `Store Commerce Support Ticket` = n8n Data Table **row.insert** |
| Commerce Catalog Query | `oOOXicKXGkBskKqh` | `e0f1e345-8e6c-40cb-8e6a-d7ad2eb92696` | Data Table **row.get**, tenant resolver, ranking |
| Commerce Cart Preview | `igPOsSbEgd4NgtRA` | `eff32e20-a6d0-4975-88b8-107eae752b4b` | Data Table **row.get**, tenant resolver, cart preview |
| Tenant Resolver | `5Eeh8hbpsoNhuiVo` | `a99c7350-7aea-446d-bdc5-4b10f52c3ad1` | Channel/Tenant/Features resolver, current implementation uses n8n Data Tables |

Core Draft `c96422e0-170b-46a3-8d75-3a2695e645e7` differs from current Published `456862c9-e5ee-4bfa-9931-47dbc39ab73d`. This phase **pins Published only**; Draft cannot silently be treated as deployed. Do not publish new versions without QA review.

**Security finding:** Having `canWrite:false` in prompt or response does **not** remove a tool that can call `DataTable row.insert`. Direct public Widget → published full Agent is therefore **NO-GO** even if old workflow is named SANDBOX. Never call it from the current untrusted browser.

## 2. IMPLEMENTED — what changed

Only new source in `qa/channel-v1852/` and scoped CI:

- `published-core-readonly-admission.cjs`: source-only strict allowlist `CATALOG_QUERY`, `CART_PREVIEW`; exact published version IDs, 5-node path with DataTable `get`, Resolver ID, exact node/edge allowlist. Fail-closed on changed version, extra tool, rerouted edge, wrong Tenant/Store, wrong response metadata, unauthorized mode or client-provided scope.
- `source-admission-manifest.cjs`: independently read n8n IDs/versions and publicly unsafe support ticket tool reachability.
- `published-core-readonly-admission.test.cjs`: synthetic injected only. Reject wrong published version, extra nodes/edges, insert/update, forged scope, cross-Store readback, injected Store ID, price/stock mismatch, write intents, order confirmation, private metadata.
- `read-only-approval-packet.json`: all approvals to modify Cloudflare Worker, Access, real service caller, n8n, database, customer data, paid services and production remain **FALSE**.
- `.github/workflows/v1852-published-core-readonly-nohost.yml`: run inherited V14.3/V14.4/V18.5/V18.5.1 regression tests + new V18.5.2 tests + nohost/static deployment gate.

**No new Commerce AI agent was created.** The candidate targets **existing child tools** of current Commerce Core; it does **not** execute the full Agent. All tool responses in tests come from a local deterministic mocked port. Actual n8n tool read-only behavior is based on inspected Published graph but has **not** been called live.

## 3. TESTED — evidence

- Source: 142 synthetic Node tests **PASS 142/142** at commit `dd595fb621fdc51033daa9f1840a236cc1f132fb`.
- GitHub Actions [V18.5.2 run #44256407436](https://github.com/ngoctien20/demo-git/actions/runs/44256407436) **SUCCESS** at that commit.
- Initial CI attempt: two tests incorrectly lacked `async`. Corrected. A second CI attempt: static test expected list order before sorting; corrected. Last run passed both functional and static controls.
- This tests **source logic and synthetic readbacks**; real website → hosted Gateway → signed Access → n8n Core/child end-to-end UAT **0**, no real signed Owner A/B, no real store RLS or customer order reads.
- Existing V18.5.1 Cloudflare Worker `tien404-widget-gateway-v144-staging` was **not changed** and remains a previously read-only verified LOCKED 423/no routing candidate. Do not deploy the separate deny-only fixture as a second Worker.

## 4. Proposed next release gates

1. **Explicit authorization** of exact private staging host, Access app/policy and **reuse of locked existing V14.4 Worker**, no public/unprotected route or broad Bypass. Preserve original Worker version/routes/policies and rollback plan.
2. Configure and independently verify **real** Access JWT signature, issuer, audience, expiry, revocation, exact origin/domain installation authority, signed short-lived sessions, D1 atomic replay and quota with measured billable cost. No real customer credential in source.
3. Independently approve a **server-to-server read-only n8n caller** that can invoke only exact Published child `oOOXicKXGkBskKqh` and `igPOsSbEgd4NgtRA`; ensure no sidecar tools or OAuth privilege can insert; reject any changed Published version; verify runtime zero writes by execution traces. Calls to full Agent `iyfGUiEsZlNTBWOR` are still NO-GO until its reachable ticket write tool is isolated with a separately approved execution-level policy.
4. Approved Platform Consultant **public Sandbox** read-only tests first; Merchant Sandbox only after independent owner/Store authorization. Never infer merchant identity from Widget ID, Origin, Referer, signed anonymous session alone.
5. Real end-to-end no-send/no-write UAT with real request trace, timeout/429/replay, input prompt injection, wrong Store, mobile/desktop UI, revoked domain; no unintended billing or provider sends.
6. Go/No-Go after security review, backups/restore drill, zero-write evidence; no production changes from this Draft.

## 5. No-change and rollback evidence

No changes to `gh-pages`, website widget flag, n8n workflow definitions or Published versions, credentials, Cloudflare Worker/Access/D1, Render, Supabase, orders, customers, Messenger, Zalo, billing or provider sends. No model usage from this phase, no added paid infrastructure.

Source rollback: close/revert PR #405; parent PR #404 and all existing workflows remain untouched. Hosted rollback, if separately approved later, must disable route, restore original Worker/Access, revoke session and verify deny before cleanup; customer data deletion requires separate approval.

**Checkpoint decision:** `V1852_SOURCE_QA_142_OF_142_PASS / REAL_N8N_GATEWAY_UAT_0 / FULL_COMMERCE_AGENT_WRITE_TOOL_REACHABLE / ONLY_PUBLISHED_CATALOG_AND_CART_CANDIDATES / OWNER_AB_NO_GO / PRODUCTION_NO_GO`.
