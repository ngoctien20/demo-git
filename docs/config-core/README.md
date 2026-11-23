# TIEN404 Universal Configuration Core v1 (Phase 1)

Status: **APPLIED to restore-test and staging on 2026-11-22 07:01–07:04 UTC (owner-approved), hosted UAT 21/21 each. No live bot reads it yet.**

## Model

```
Tenant ─┬─ Store (V20) ─┬─ Assistant ── assistant_config_versions (draft | published | superseded)
        │               └─ Channel Connection (messenger page / web site / zalo bot …) ──► Assistant
        └─ members (tenant_memberships + store_memberships: owner | manager | staff)
Global, read-only: action_types (Action Registry), industry_templates (shop, artist, service, education)
```

* Tenant ≠ Store ≠ Assistant ≠ Channel. One Page/Zalo bot/site id is bound to exactly one tenant/store
  (`UNIQUE(channel, external_account_id)`), created by service_role/admin only.
* A config version is one JSON snapshot (greeting, addressing, optional profile, ≤12 menu items with
  channel overrides). Published snapshots are immutable (trigger, also for the DB owner); rollback
  publishes a **new** version copying an old one.

## Config JSON (schema_version 1)

```json
{ "schema_version": 1,
  "greeting": "Chào bạn! …",
  "addressing": { "self": "mình", "customer": "bạn" },
  "profile": { "display_name": "…", "bio": "…" },
  "menu": [ { "id": "handoff", "action_type": "HUMAN_HANDOFF", "label": "Gặp nhân viên",
              "enabled": true, "sort_order": 40, "action_config": { "team": "sales" },
              "channel_overrides": { "zalo_bot": { "label": "Gặp NV" } } } ] }
```

* `id` = stable_action_id (business key). `label` is display text only.
* Unknown keys are rejected at every level → no tool name, SQL, JS, webhook, tenant id or credential.
* Actions released: SHOW_CATALOG, SHOW_CONTENT, SHOW_PROFILE, OPEN_LINK, SHOW_PLAYLIST, ORDER_LOOKUP,
  HUMAN_HANDOFF, CONTACT_INFO, SHOW_SERVICES, FAQ. Experimental (draft only, cannot be published):
  SEARCH_KNOWLEDGE, BOOKING_REQUEST.
* Links: https only, no IP/localhost/port/userinfo; YouTube kind and playlists only on YouTube hosts.
  Template links contain `THAY-LINK` and are disabled; an enabled placeholder cannot be published.
* HUMAN_HANDOFF `team` ∈ sales, page_admin, booking, consultant, support, manager. Default
  acknowledgement names the team, never promises the artist/owner in person. The Messenger handoff
  mechanics (pass thread control, ack only after success, label) stay exactly as in live d1ec9147.

## API (Supabase RPC, `authenticated`; owner/manager of the Store; staff = read only)

| RPC | Purpose |
|---|---|
| `create_assistant(store, name, template_key)` | new Assistant + draft v1 copied from template |
| `save_assistant_draft(assistant, config, expected_sha)` | validate + save draft; stale sha → `PT409 draft_changed` |
| `publish_assistant_config(assistant, expected_sha)` | publish-mode validation, old published → superseded |
| `rollback_assistant_config(assistant, version_no)` | new published version = copy of old one (re-validated) |
| `resolve_channel_assistant(channel, account)` | **service_role only**: trusted tenant/store/assistant + published config for an adapter |

Reads: `SELECT` on `assistants`, `assistant_config_versions`, `channel_connections` (RLS: active Store
members only), `action_types`, `industry_templates`.

## Channel renderer (`config-core/lib/channel-render.mjs`)

| Channel | Output | Verified |
|---|---|---|
| messenger | persistent menu (≤20, title ≤30) + quick replies (≤13, title ≤20, no links) | yes (limits per Meta docs; not yet sent live) |
| web | buttons (≤12, label ≤40), link buttons | yes (widget contract #488) |
| telegram, zalo_bot | numbered text list, reply with number | yes (both adapters are text-only today) |
| zalo_oa | numbered text list | **no** (OA API not verified) → `verified:false` |

Payload = `T404:M:<item id>` only. The server resolves it against the published config; disabled,
experimental, unknown or malformed ids are rejected. Legacy `TIEN404:*` payloads map to their current
behaviour (`kind:'legacy'`).

## Files

* `db/config-core/10_config_core.sql` — migration (precheck, idempotency guard). Rollback `90_config_core_rollback.sql`.
* `config-core/lib/*.mjs` — validator, templates, renderer (pure). `node config-core/build-seed.mjs` regenerates the SQL template seed.
* `config-core/test/` — unit tests; `qa/config-core/offline-pg-uat.sh` — offline Postgres UAT incl. SQL/JS parity.
* `.github/workflows/tien404-config-core.yml` — CI (PG17, no hosted access).

## Run

```bash
node --test config-core/test/*.test.mjs
PGHOST=/path/to/socket PGPORT=5432 bash qa/config-core/offline-pg-uat.sh   # local only
```

## Hosted apply record (2026-11-22, run 44996262167, workflow tien404-config-core-hosted.yml)

| Target | Steps | Result |
|---|---|---|
| restore-test `cunxxzxaboazbszsfneo` | apply 10 → hosted UAT → rollback 90 → re-apply 10 | UAT `pass=21 fail=[]`; fp pre `4841cd7e…` = after rollback; post `03fbc6cb…` = after re-apply |
| staging `ifxlvrhyjhbzbrkdsida` | encrypted backup (artifact 14744056444, sha256 `f536655f…`, 90 days) → apply 10 → hosted UAT | UAT `pass=21 fail=[]`, 0 UAT rows left; fp pre `4841cd7e…`, post `03fbc6cb…` (same as restore-test) |

Applied with psql → not recorded in `supabase_migrations`. Auth in hosted UAT is simulated (role + jwt claims), not GoTrue-signed.

## Apply order (needs owner approval per step)

restore-test → staging, via psql like V20; rollback = `90_config_core_rollback.sql` (drops config data:
export `assistant_config_versions` first).

## Phase 2 (2026-11-22): bot reads the published menu, owner edits it in the App

Owner approvals: "được tiếp tục" 07:15Z (Phase 2, no live publish, no merge) and decision card 07:23Z
("Hàm chỉ-đọc cho anon").

* `db/config-core/20_channel_menu_read.sql` — `public.get_channel_menu(channel, account)`, SECURITY DEFINER,
  EXECUTE to anon. Returns only what a customer of that channel already sees (greeting, addressing, profile,
  enabled + released buttons) for an ACTIVE connection with a PUBLISHED version. No tenant/store/assistant ids,
  no drafts, no history; unknown/disabled → NULL. Rollback `80_channel_menu_read_rollback.sql`.
* `config-core/lib/bot-bridge.mjs` — `decide(menu, event)` → legacy / ai / handoff / direct / greeting / rejected.
  Catalog, orders and FAQ go to the existing AI agent as a plain sentence; handoff uses the sentence the live
  classifier already treats as a human request; profile/contact/services/content answer only from owner data
  ("chưa có thông tin" when empty). Payload `T404:M:<id>` can only name a published, enabled, released item.
* n8n sub-workflow `9HXjjJ5ghPKUu43b` "TIEN404 CONFIG MENU BRIDGE" (folder 05_TIEN404_DEV_FACTORY - STAGING),
  **not published**, generated by `config-core/n8n/build-bridge.mjs`. Read error or timeout (3 s) → `legacy`,
  so wiring it into Z7Fd later cannot break the current flow. Wiring = one Execute Workflow node; separate approval.
* Owner App page **Menu trợ lý** (`apps/owner/src/pages/Menu.tsx`, route `#/menu-tro-ly`): create assistant from
  a template, rename/enable/reorder/add/remove buttons, per-action fields, live preview (Messenger / Website /
  Zalo-Telegram) with the same renderer, save draft (sha concurrency), publish, version history + re-activate.
  The Messenger persistent menu at Meta is NOT changed by publishing (separate approved step).
* `qa/config-core/hosted/bind-demo-page.sql` binds the demo Page `2379295362359912` (environment `demo`) to a
  published assistant "Trợ lý Messenger demo" of QA Shop A on staging. Undo: `unbind-demo-page.sql`.

### Hosted apply record, step 20 (2026-11-22, run 44998110645, workflow tien404-config-core-20-hosted.yml)

| Target | Steps | Result |
|---|---|---|
| restore-test | apply 20 → hosted UAT 20 → rollback 80 → re-apply 20 | UAT `pass=9 fail=[]`; `T404_CC20_ROLLBACK_OK`, re-apply OK |
| staging | encrypted backup (artifact 14744078005 `tien404-staging-pre-cc20-2026-11-22T0727Z`, digest `sha256:51e9e785…`, 90 days) → apply 20 → hosted UAT 20 → bind demo Page | UAT `pass=9 fail=[]`, 0 UAT rows left; `DEMO_MENU=1:catalog,order_lookup,handoff:false` (no ids) |

Note: the V20 fingerprint (`03fbc6cb…`) does not cover public functions, so it is identical before/after 20;
the rollback drill is proven by the `T404_CC20_*` markers, not by the fingerprint.

Live bridge read against staging (n8n draft, manual test, nothing published): exec 6691 demo Page + `T404:M:catalog`
→ `mode:'ai'`, "Shop đang có những sản phẩm nào?", configVersion 1, sha `7d9ebe9d…`; exec 6692 unknown Page → `legacy`.
