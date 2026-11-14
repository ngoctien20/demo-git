# TIEN404 AI V12.2 — Shop B Conversation Sessions & Secure Sandbox Order Gate

**Checkpoint:** 14/11/2026 (JST)  
**Release:** EXPERIMENTAL / DRAFT PR #41 / staging-only, **NOT ACTIVATED ON ZALO WEBHOOK**  
**Scope:** Tiếp tục từ nghiệm thu Owner-device Zalo → V1 → Owner Gate → preview F01 398.000đ, 14/11/2026 lúc 22:52:30 JST.

## 1. VERIFIED (đọc trực tiếp hệ thống)

- n8n `TIEN404_ZALO_BOT_LAB_V1_STAGING` workflow `yIJk8LvJoLF40Z62`, published `08f22ee1-cf5a-4459-bd33-bf80ac67af0e`, active.
- n8n `TIEN404_ZALO_V2_SHADOW_STAGING` workflow `OgDZNSAvKEvhnAvn`, published `f00ba506-c52a-4340-9a0c-809fd9c6ea9a`, active.
- Supabase staging `ifxlvrhyjhbzbrkdsida`: schema `tien404_r1_qa`, RLS enabled on 8 tables. Shop B F01 `199000 VND / stock 5`; Shop A F01 `159000 VND / stock 3`.
- Existing `tien404_r1_qa.commit_order_qa` is `SECURITY INVOKER`, checks `dry_run/synthetic_qa`, live catalog under tenant, stock, integer money, expected_total, current Owner binding; uses `ON CONFLICT` idempotency and generates `HELD/SEND_DISABLED` outbox. **Do not recreate or call it from chat yet**.
- Original QA catalog snapshot at `2026-11-14T12:41:35.598Z` has a 3-hour lease: cannot substitute for authenticated DB readback after it expires.

## 2. IMPLEMENTED

Added new code on `work/v12-shop-b-dialogue-staging-20261114`, preserving prior live/staging Shadow and V1:

- `qa/zalo/shop-b-session-service.cjs`: a pure backend-side service with injected atomic transaction repository, trusted Owner identity and normalized webhook event. Supports direct price, stock, 2-turn quantity, draft, cancel, strict one-use confirmation, binding isolation, stale price/stock rejection, and proposal-only order submission.
- **Confirmation:** `crypto.randomBytes(16)` generates a 128-bit code. Persisted state contains only SHA-256 hash scoped to Owner/binding; quote expires after 10 minutes or sooner with binding expiry; session expires after 30 minutes. Re-pair changes the namespace.
- **Deduplication:** event hashes are stored in an injected repository. Its contract requires a single PostgreSQL transaction with row lock and unique receipt to ensure concurrency safety; the module deliberately does not issue SQL or send Zalo messages itself.
- **Commit proposal:** return keys compatible with `commit_order_qa` conventions (`QA-B-`, `qa-session-`, confirmation and idempotency hashes), but `write_executed=false`. Never treat a proposal as saved order.
- `qa/zalo/shop-b-session-service.test.cjs`: 44 tests covering replay, two concurrent messages, two concurrent confirmations, wrong tenant, re-pair, group chat, foreign catalog, stale price/stock, expiry, no plaintext code in storage, PII minimization and no external sends.
- `.github/workflows/v12-shop-b-dialogue-qa.yml`: runs previous 44 + new 44 cases.
- `docs/ai-handoff/V12_2_SHOP_B_PRIVATE_SESSIONS_REVIEW_ONLY.sql`: candidate for **private tables with RLS / deny-by-default** and PostgreSQL transaction/row lock design. **NOT APPLIED** to Supabase.

## 3. TESTED

| Test layer | Evidence | Result |
|---|---|---|
| GitHub Actions | run `43603033722`, job `132471667440` | **88/88 PASS**, 0 fail; Node 22 |
| Previous conversation engine | same run, 44 original tests | PASS |
| New secure session service | same run, 44 tests incl. memory-level concurrent replay | PASS |
| Real Zalo ingress acceptance | V1 `v1_shop_b_order_cmd` 13:52:30.554Z, `owner_gate=eligible`, Shadow preview 13:52:29.943Z | PASS for **read-only single-turn preview** |
| Current Supabase | read-only schema/function/catalog inspection | VERIFIED; no migration or order modification |

**Critical limitation:** Simulated transaction locks in Node tests do **not** prove a real PostgreSQL concurrent transaction or signed Zalo multi-turn session works.

## 4. BLOCKED — Required before wiring into Shadow

**P0 — Authenticated adapter:** Implement server-only resolver deriving Owner/tenant/recipient from **provider-verified** webhook and current DB pairing; must not accept `server_verified` booleans from client JSON. Bot Manager and customer chat must not be allowed to spoof Owner.

**P0 — Real PostgreSQL transaction:** Review new private schema SQL, apply only to isolated staging after checkpoint/backup and explicit Owner approval; implement atomic `SELECT FOR UPDATE` + unique receipt in the same transaction. Run two independent workers simultaneously, rollback injection, session expiration and cross-tenant negative QA.

**P0 — Fresh DB readback:** Implement `tx.getCatalog` against `tien404_r1_qa.catalog` under verified tenant, inside the transaction; reject stale QA snapshot and always revalidate before creating a sandbox order.

**P0 — Order commit:** Require second distinct approval for connecting confirmed proposals to `commit_order_qa`; backend must verify one-use confirmation, verify expected_total, record actual order + HELD outbox, and read back before saying “đã tạo đơn”. Keep Commerce customer Orders completely separate.

**P1 — Outbound Zalo:** The global send switch `ZALO_SEND_ENABLED=false` must remain disabled. Auto-reply to even one Owner needs separate explicit approval, recipient/policy check and rate limiting. Successful one-shot previously approved is not a blanket grant.

## 5. Integration contract (PROPOSED, not deployed)

`POST /internal/qa/zalo/shop-b/turn`: trusted internal backend receives normalized event with verified provider signature and server-resolved binding (NOT client tenant/store IDs). Service resolves private session scope, locks state + receipt, reads current F01 price/stock, persists only sanitized draft/hashed confirmation, returns preview or `commit_proposal`. Webhook upstream ACK must be independent of provider send. No client-exposed RPC, no raw chat IDs in QA tables.

**State machine:** idle → viewing → await_quantity → await_confirmation → commit_pending; cancel/reset, expiry and rejection are fail closed. Current code is a candidate and not active in published V1 or Shadow.

## 6. RISKS / APPROVAL / ROLLBACK

- **P0:** Credential leakage, cross-tenant mapping, session race, stale Owner binding, client-forged `server_verified`, order double-commit, exposing confirmation code in logs.
- **Approval required:** apply any database migration; connect actual sandbox order-writing RPC; enable outbound Zalo; merge draft PR into shared staging branch; publish production. Read-only inspections and isolated CI tests were performed without those changes.
- **Rollback:** close/revert PR #41 code/files. Existing published V1, Shadow, Supabase Orders/Products/outbox and Cloudflare gateway unchanged by V12.2. SQL is documentation only, so there is no database rollback.

## 7. NEXT ACTIONS

1. Owner approves dedicated **private staging QA session schema migration** after SQL/RLS review and backup (or provide isolated existing transaction store).
2. Implement Postgres repository adapter behind authenticated Owner resolver, test concurrency and RLS fail-closed in database.
3. Run no-send Shadow integration in staging with actual Owner inbound, but no order write.
4. After signed off, separately approve sandbox order commit and Zalo auto-reply Owner allowlist only.
5. Only then consider Core Bot candidate or non-Owner pilots; no production promotion without manual gate.
