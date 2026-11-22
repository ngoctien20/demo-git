# TIEN404 Universal Configuration Core v1 (Phase 1)

Status: **IMPLEMENTED + TESTED offline. NOT applied to any hosted database. No live bot reads it yet.**

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

## Apply order (needs owner approval per step)

restore-test → staging, via psql like V20; rollback = `90_config_core_rollback.sql` (drops config data:
export `assistant_config_versions` first).
