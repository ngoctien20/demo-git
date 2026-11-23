# V25 Universal SaaS Experience

Branch `claude/project-thread-ayzjzo`. Stacked on Draft PR #489 (V21 Config Core, branch `claude/project-thread-xv1r63` @ 886f1f2e) and on #487 (V23 web, branch `claude/project-thread-4ko028`, merged in at 966dbe03).

| Commit | Content |
|---|---|
| 966dbe03 | Merge base: #489 + #487 |
| fd66a82a | Public site: multi-industry platform |
| ad6ceab8 | Owner App: Universal Workspace + site motion |
| (this commit) | Docs, screenshots |

No database migration, no n8n change, no credential/RLS change, no deploy.

## 1. Audit (read-only, 2026-11-22)

| Item | State | Note |
|---|---|---|
| develop | 0e12f4ce | #482, #483, #486 merged |
| #489 Config Core | Draft | Tables + RPCs on staging; this work reuses them, no parallel store |
| #487 V23 web | Draft | Owner App + site generator; base of the UI here |
| #491 / #493 | Draft | #491 on #489; #493 (reaction profiles) on older #491 |
| #488 | Draft | Based on main |
| gh-pages | Missing files | Reported to the V23 thread; V25 does not touch gh-pages |
| n8n Z7FdV7uDvApfbURQ | Read only | n8n Cloud trial expired, bots silent |

## 2. Architecture

- Industry is a **mapping layer in the UI only** (`apps/owner/src/workspace.ts`): `tenants.industry` + installed `industry_templates` → `shop | artist | service | education`. `store_id` and schema are unchanged.
- All assistant edits go through one hook (`useAssistantDraft`) that writes only via `save_assistant_draft` (optimistic `p_expected_sha`). Publish / rollback use the #489 RPCs. Published versions stay immutable.
- Channel rendering uses `config-core/lib/channel-render` caps; preview shows the text fallback a channel uses when buttons are not shown.
- Reaction profiles: `reaction-profiles.mjs` + `social-reactions.mjs` copied verbatim from #493 (same content, so no conflict later). UI switch is **OFF and disabled**.
- Reads are store-scoped (`eq('store_id', …)`) and still protected by RLS with the publishable key. `channel_connections` is read-only in the App.

## 3. Feature × industry × channel

| Feature | Shop | Artist | Service | Education | Messenger | Zalo | Web | Telegram |
|---|---|---|---|---|---|---|---|---|
| Assistant wizard (template) | IMPLEMENTED | IMPLEMENTED | IMPLEMENTED | IMPLEMENTED | – | – | – | – |
| Menu Builder + preview | IMPLEMENTED | IMPLEMENTED | IMPLEMENTED | IMPLEMENTED | preview | preview | preview | text fallback |
| Industry module page | products/orders (V23) | Hồ sơ & âm nhạc | Dịch vụ & lịch hẹn | Khóa học & tuyển sinh | – | – | – | – |
| Booking automation | – | PROPOSED | PROPOSED | PROPOSED | – | – | – | – |
| Channel Integration Center | read-only status | ← | ← | ← | real rows only | ← | ← | ← |
| Reactions | OFF | OFF | OFF | OFF | not sent | – | – | – |
| Daily Briefing | CANDIDATE (UI only) | ← | ← | ← | – | – | – | – |
| Live delivery to customers | NOT RUN | | | | BLOCKED (n8n trial) | NOT RUN | NOT RUN | NOT RUN |

## 4. QA (mocked Supabase that imitates RLS; no production data)

| Check | Result |
|---|---|
| `qa/v25-universal/workspace-ui.cjs` (4 users × routes × 360/390/768/1280/1440) | PASS: 116 route×viewport checks, 26 assertions |
| `qa/v23-web/app-ui.cjs` regression | PASS |
| `qa/v25-universal/site-screens.cjs` (9 pages × 5 viewports × motion on/reduced) | PASS: no overflow, no console errors, one h1, nothing left hidden |
| `tests/test_v2[35]_*.py` | OK |
| `node --test config-core` | 95/95 |
| tsc + build, nav check, qa_static | OK |

Assertions include: store isolation (`?a=` from another store ignored), staff read-only, draft vs published badges, rename/reorder keeps button ids, reaction OFF, briefing save disabled, "—" for metrics without source, no secrets in bundle.

Screenshots: `screens/before_*` (develop site) and `screens/after_*`, `screens/app_*`.

## 5. Limits

- Live Messenger/Zalo: NOT RUN. n8n trial expired; no real sends allowed.
- Industry is inferred from tenant name/templates; no RPC to edit it yet.
- Typing "menu" to reopen buttons is PROPOSED (described as in preparation on the site).
- Booking, briefing sending, reactions: no backend.

## 6. Needs separate approval

1. Deploy V25 site + App (and fix gh-pages missing files first).
2. Backend for Daily Briefing (scheduler + sender).
3. Booking backend; "menu" text command in n8n.
4. Meta persistent menu change.
5. RPC to set tenant industry.
6. Turning any reaction profile ON; move reaction libs once #493 lands.

## 7. Rollback

Code only: `git revert ad6ceab8 fd66a82a` (plus this docs commit), or keep branch base 966dbe03. Nothing to undo in the database or n8n.

## 8. Follow-up (V25.1, 2026-11-23)

- `db/v25-workspace/10_workspace_settings.sql`: `workspace_profiles` + `save_workspace_profile` (owner only): free industry name (2-60 chars), ANY mix of modules shop/service/education/artist (or none), own word for customers. 16 presets in the App are only starting points. `store_briefing_settings` + `save_briefing_settings` (owner/manager; status fixed to `awaiting_sender`, nothing sent). Rollback `90_workspace_settings_rollback.sql`.
- App: "Hồ sơ ngành" on Cài đặt (presets + free name + module checkboxes + customer word; nav, Overview, Customers follow it); Daily Briefing save works when the server has the table, otherwise stays "chưa mở".
- Wording: login and 404 no longer say "cửa hàng / chủ shop".
- QA: `qa/v25-universal/offline-pg-uat.sh` 54 cases (apply → rollback → re-apply), `workspace-ui.cjs` extended (owner/staff/missing-server cases).
- 2026-11-23 02:04Z APPLIED (Tiến: "mấy cái cần duyệt anh duyệt hết"): restore-test then staging via Supabase migration `v25_workspace_settings` (staging version 20261123020421). Hosted UAT on both (owner save, briefing save, cross-tenant denied, direct insert denied, other tenant sees 0, anon denied) inside a rolled-back block; residue 0.

## 9. Daily Briefing sender (V25.2, 2026-11-23, PROPOSED)

- `db/v25-workspace/20_briefing_sender.sql` (rollback `80_briefing_sender_rollback.sql`). No service_role:
  - n8n calls `briefing_claim_due_v1()` / `briefing_report_v1(delivery, ok, error)` via PostgREST with the publishable key plus header `x-t404-briefing-key`. The key is generated inside the DB and stored only in Vault (`t404_briefing_sender_key`); the owner copies it once into an n8n credential.
  - Ledger `app_private.briefing_deliveries` (UNIQUE store + local date) means at most one email per Store per day, even on retries.
  - Recipients = confirmed emails of active owner/manager of that Store. Metrics from the last 24 h, only those the owner picked; no source → "chưa có dữ liệu".
  - `briefing_recent_deliveries(store)` lets owner/manager see the last 7 sends (no addresses).
- n8n workflow `lSBmm3t6P6RlTGEm` "TIEN404 V25 – Báo cáo sáng (email)" (folder Commerce / 01_CORE - ENGINE), DRAFT, not published. Source: `n8n/v25-briefing/workflow.sdk.js`. Schedule 15 min → claim → build email → Gmail → report.
- QA: `qa/v25-universal/offline-briefing-uat.sh` 42 cases (apply → rollback → re-apply; wrong/no key denied; once a day; telegram excluded; staff and unconfirmed emails excluded). In CI.
- To go live: apply 20 on restore-test → staging; create n8n credential "T404 briefing key" (templated custom auth, header `x-t404-briefing-key` = Vault value); publish the workflow.
