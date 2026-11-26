# TIEN404 V17.12 — Actual Central Commerce Core Integration × Per-Message Fail-Closed QA

**Date:** 2026-11-17 JST. **Status: IMPLEMENTED + HOSTED n8n QA TESTED (negative-path only); LIVE external bot NOT RELEASED.** Owner approval for eventual central bot LIVE retained.

## What was actually implemented

New original **inactive** n8n workflow under Personal / `90_QA - DIAGNOSTICS`:
- Workflow ID `7XzLd51D7C6tlaS4`
- [Open native n8n workflow](https://ngoctien20.app.n8n.cloud/workflow/7XzLd51D7C6tlaS4)
- Final read-back QA workflow draft version `21f1c645-878d-46e8-851c-54b1cfa568ab` (**inactive, not Published**). Initially built with validated n8n Workflow SDK (4 nodes), then updated to 5 nodes.
- Components: manual-only QA trigger -> synthetic untrusted message -> generator of eight scoped invalid channel cases -> **Execute Sub-workflow** invoking existing central Commerce Agent `iyfGUiEsZlNTBWOR` -> strict fail-closed assertion.
- `Invoke Actual Commerce Core - Sandbox Only` explicitly sets `mode = each` to avoid n8n processing multiple messages as one.
- No Webhook trigger, no Meta/Zalo outbound, no Google Sheets tool, no order modification, no payment, no credential or billable model node in the new QA workflow. It is not Published.

**This is the REAL existing central Commerce Agent, not a duplicated fictional Core.** The nested central Core in turn calls existing `5Eeh8hbpsoNhuiVo` trusted Tenant resolver, which deliberately denies any installation that isn't configured and verified.

## Real n8n execution evidence

1. Execution **#4375** SUCCESS initial single-case preflight. Nested actual Core **#4376**, resolver **#4377**, all returned `success:false`, `canSend:false`, `canWrite:false`, `reason:unregistered_or_disabled_channel`. All model, provider send and write paths absent from nested run data.
2. QA generator was expanded to **8 synthetic invalid cases** (unregistered Messenger, fake Zalo OA, fake Website, unsupported Telegram, empty channel type, empty account ID, prompt-injection cross-Shop claim, unconfirmed image/order request). First run **#4378 FAILED** assertion: the n8n Execute Sub-workflow node used implicit default `once`, collapsing **8 input items to 1 Core result**. Crucial actual integration bug discovered before LIVE.
3. FIX APPLIED **only to new INACTIVE QA workflow**: `mode: "each"` on `Invoke Actual Commerce Core - Sandbox Only`. This is not a production Core change or real order write.
4. Re-run **#4381 SUCCESS**, input count=8, Core response count=8, final assertion `V1712_ACTUAL_CENTRAL_CORE_EIGHT_NEGATIVE_CASES_PASS`; `total:8`, `denied:8`, `actual_core_subworkflow_calls:8`, provider sends=0, writes=0, external models=0.
5. Nested Core executions **#4382, #4384, #4386, #4388, #4390, #4392, #4394, #4396**, all **SUCCESS** but each blocked untrusted channel. Representative #4396 nodes `Resolve Commerce Tenant` -> `Known Sandbox Tenant?` -> `Reject Unknown Shop`; no `Commerce Sandbox Agent` or `Commerce OpenAI Model`. This is **negative-path acceptance**, not model quality or production response UAT.
6. No real provider HMAC or Page/OA ownership tested by these fixtures, no bound Store authenticated JWT-RLS, no current independent FULL_SERVICE restore proof.

## Architecture and owner request

- Bot Core `iyfGUiEsZlNTBWOR`: still **INACTIVE**, no public ingress, no live send. Its downstream resolver `5Eeh8hbpsoNhuiVo` still rejects live candidates with `live_connector_not_implemented`, correctly retaining a mandatory security release gate.
- Existing real Meta Messenger DEMO `Z7FdV7uDvApfbURQ` Published version `d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92` MUST remain active and unchanged, with legacy DEMO tools isolated. Never replace webhook callback or expose demo orders as multishop source.
- Zalo technical Bot staging `yIJk8LvJoLF40Z62` Published version `8ca4a6f6-ab3f-42f1-8637-d4f5db790a3e` remains ACK/no-send, and Zalo OA provider merchant authority not yet certified.
- New four-tab commercial staff entry Sheet `1siR8y7lxrYch8w6P1CVn5ta6XdWpYX9NJ384Yb1kujw` remains separate and not attached to either bot.
- Supabase hosted Commerce previously checked: no canonical `public.stores`/`public.store_memberships`, no Store ID on six canonical public surfaces, zero Store-qualified RLS policies. Can't authorize retail Commerce read/write for Shop A and B based on synthetic fixture.
- Owner permission for LIVE recorded at V17.11; technical production acceptance remains independently evidence-gated.

## Next gate to enable real LIVE experiment

1. Get independently verifiable (non-secret) authorization for **exact existing Messenger Page / Zalo OA** and the provider installation/callback binding; retain known-good published webhook snapshot and approval to change only that exact route.
2. Build a **non-public, separately versioned, server-authenticated inbound bridge** to the actual existing Core. Only allow read-only catalog/FAQ on verified QA-owned Store scope after authorized Page/OA signed event and per-Store binding. No real personal data until scoped consent.
3. Run one real signed ingress **NO-SEND** canary to the Core read-only gate; record real provider event ID, duplicate denial, Store isolation. Current synthetic QA is not a substitute.
4. Then bounded owner-only auto-reply pilot; only after Store six-surface JWT-RLS, original four Product/Order ownership attestations, real current recovery and transactional idempotent writer may order/stock transition LIVE.
5. Ensure `executeWorkflow` uses `mode: each` whenever forwarding multiple inbound messages. Add multi-item regression assertions to candidate bridge before publishing.

## QA / rollback / checkpoint

- **VERIFIED**: Actual nested Core and Resolver execution IDs, 8/8 deny outcomes, lack of model/outbound/writes, current production versions.
- **IMPLEMENTED**: New 5-node inactive n8n QA workflow; mode each correction and strict eight-case assertions.
- **TESTED**: #4375 success, **#4378 intentional failure detected**, **#4381 corrected SUCCESS 8/8**. Preserve failed run as evidence, don't erase.
- **BLOCKED**: First true Commerce-central provider LIVE request/reply/Store permissions.
- **ROLLBACK**: revert inactive QA workflow to V17.12 initial version or archive after approval. No Published/live Meta/Zalo/n8n existing workflow, Supabase, GSheet or credentials changed.
