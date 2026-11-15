# TIEN404 V14.6-01 — Canonical reconciliation and L2 no-send evidence

**16 Nov 2026 JST | DRAFT / EXPERIMENTAL / SOURCE-ONLY.** No real AI, hosted database writes, Meta/Zalo sends, n8n Published modifications, billing, credentials or production deployment.

## VERIFIED — read-only plugin audit

- GitHub PR #103 HEAD 1c8e7de063e9909c12a8233428fe4b1a038ea69e, PR #110 HEAD 14ae74bf55176a1f973c002d8d1ec211ca775e9e. Both OPEN DRAFT. PRs #86, #94, #102, #108, #109 and #111 are also OPEN DRAFT.
- PR #110 CI run https://github.com/ngoctien20/demo-git/actions/runs/43745272062: 3/3 SUCCESS; 33 new and 579 inherited Node regressions; 30 functional and 8 real PostgreSQL 17 concurrency assertions, isolated database only.
- n8n: 100 workflows, 19 active and 81 inactive. New Zalo UAT01 manual workflow teHbeNGZn7e1TuSy is inactive, execution 3864 success. Published Messenger Z7FdV7uDvApfbURQ remains active with 27 nodes, version d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92; offline QA jeLqAGOlG06LanDv is inactive, historical execution 3862 success.
- Legacy AI_SALES_DEMO Create Order KrSn4DNR9ALX5ng4, Manage Order fDB9dvs1qPPVt9Sp, Update Order BkAi6TVUKAjCnI7v, Revenue U2DJsxzSYPH5hRop: Draft version differs from Published. Do not republish silently.
- Supabase staging: 3 Auth users (aggregate count), 2 Products, 2 Orders. No canonical public.stores/public.store_memberships, no store_id across five core Commerce tables, five inspected tenant-wide PERMISSIVE SELECT policies. Full Auth-dependent backup restore and four-row ownership remain BLOCKED.
- Security advisor warnings: qa_shop_b_zalo_claim SECURITY DEFINER callable by anon; qa_owner_pairing and save_merchant_product SECURITY DEFINER callable by authenticated. Need review, no automatic GRANT changes.
- Cloudflare outbound Zalo Worker ZALO_SEND_ENABLED=false; LIVE02/LIVE03C D1 bindings; locked Widget Worker has no bindings. No secret values read.
- PR #103 reports synthetic Zalo UAT01 owner acceptance 8/8 self-reported and HTTP QA, NOT live Bot identity or send certification.

## Dependency overview — no automatic merge

- Shop Knowledge #85 -> Store RLS #86 -> separate backup #98.
- Messenger Rich UI #87-#93 -> Replay #95; Widget #94 -> #99.
- Atomic Stock #107 -> #108 -> hosted audit #109 -> recovery #111.
- Messenger Four-Flow #110 branches from #108, not #109. This V14.6-01 branch starts from #110.
- Zalo #100 -> #103, independent.
- Auth/browser fix #102 targets gh-pages, independent.

The overview is not a verified safe merge order. Independently review head/base SHA, all diffs, and CI before reconciliation.

## IMPLEMENTED — source-only bridge candidate

- qa/v14601/level2-offline-bridge.cjs reuses inherited Messenger offline engine and V14.3 response contract; no external calls, real model or database. Synthetic Shop A/B same tenant, C different, MID/sender isolation, pending confirmation and unsent in-memory outbox.
- qa/v14601/level2-offline-bridge.test.cjs has 16 tests for scoped prices, consultation, order confirmation, replay, unknown Page, cross-store/cross-sender queries and unsafe certification.
- GitHub Actions v14601-messenger-l2-nosend-qa.yml runs 16 new tests, inherited four-flow/channel regression and a static no-send guard on branch/PR.
- assessLevel2Evidence always returns canClaimLevel2=false and forbids merge/publish/hosted Orders/provider sends. Even all user-supplied VERIFIED labels cannot grant authorization.

This is a compatibility smoke gate, NOT live AI, Store JWT/RLS, real Commerce, provider signature or LEVEL 2 acceptance.

## P0 requirements before true L2

1. Server-owned raw Meta HMAC proof and Page -> Tenant -> Store binding.
2. Trusted Store-scoped catalog price and inventory.
3. Bounded real inference with model cost quota and trace.
4. Isolated staging atomic Order Request adapter with idempotency.
5. Durable no-send outbox with replay/retry/readback proof.
6. Real JWT Store A/B same tenant, C other tenant, revoked member tests, after full backup restore and independently approved four legacy Product/Order ownership mappings.
7. Independent reviewer signoff binding exact commit, workflow version, schema snapshot, test evidence and rollback.

Never apply hosted migration, data backfill, provider real send, credential change, production publish, or billing change without separate approval.

## QA / rollback / next step

Prior baseline: PR #110 CI 43745272062 successful; n8n manual QA 3862 successful. New V14.6-01 tests must be verified against this PR HEAD; files alone do not certify PASS. Local first four evidence-only cases were tested before push; integrated composition must be tested in GitHub CI against inherited source.

Rollback: close this Draft PR or revert only newly added source/tests/workflow/doc. No hosted rollback required.

**Next:** inspect new CI at HEAD; fix any failed test safely. Only after that prepare real bounded AI/Catalog/Order/Outbox Level-2 adapter in an explicitly approved staging boundary.

Acceptance: LEVEL1 TESTED; LEVEL2 BLOCKED; LEVEL3 real Meta pilot requires separate permission; LEVEL4 commercial release remains NOT APPROVED.

## FINAL QA — 16 Nov 2026 JST

GitHub Actions run [43753199454](https://github.com/ngoctien20/demo-git/actions/runs/43753199454) completed **SUCCESS** on source head `f98f5471316b8ca476f1630aaf0d18d4131089f0` before this documentation-only update. Exact job steps PASS: (1) new 16 synthetic composition tests, (2) inherited V14.4.8 four-flow and V14.3 channel regressions, (3) static NO NETWORK / NO CREDENTIAL / NO HOSTED WRITE source guard. These verify source composition only, not real Level 2.

This checkpoint update triggers an additional Actions run on the new HEAD. The earlier run must not be presented as CI of the new documentation-only commit; inspect the latest run before closing this phase.
