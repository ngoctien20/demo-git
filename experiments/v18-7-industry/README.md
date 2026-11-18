# TIEN404 V18.7 — Industry Profile Contract & Offline QA

Status: **EXPERIMENTAL / CANDIDATE implementation only**. Never production. Date: 2026-11-18 JST.
Base: **gh-pages at ff2daf970e8209399a28b2d0cade8a33b9fa71c6**.

## Why this is isolated

The website currently has static industry marketing pages but no verified canonical store registry. n8n Messenger workflow Z7FdV7uDvApfbURQ is Published; Commerce Core iyfGUiEsZlNTBWOR is active and its draft differs from Published. Do NOT wire this module into either workflow.

This package contains **only synthetic QA**: two version-pinned Industry Profile JSON files, schema, pure offline preview engine, 38 security/commerce unit tests, and optional static UI. No credentials, webhooks, provider calls, Commerce orders, data writes, or production binding.

## Business architecture

Tenant -> Canonical Store (not yet verified as a production schema) -> Industry Profile (approved version) + Store Overrides (versioned) + Store Knowledge (scoped) + Channel Capability -> Trusted Tool Gateway -> Shared Commerce AI Core.

The profile customizes fields and skills; it **does not grant** permissions. The backend intersects tenant/store identity, user role, subscription, channel capability, policy version, and action eligibility before any real tool call.

All prices, stocks and private orders come from structured, authorized Commerce data, never model output or FAQ. Cross-channel identities must not be inferred from names or matching phone numbers.

## Source inputs / references

Haravan: https://help.haravan.com/docs/social/chat-scenarios/huong-dan-su-dung-kich-ban-mau/
Haravan: https://help.haravan.com/docs/social/messenger-settings/tong-quan-cai-dat-messenger-trong-harasocial/
Gorgias: https://docs.gorgias.com/en-US/skills-explained-6556816
KiotViet: https://www.kiotviet.vn/huong-dan-su-dung-kiotviet/retail-chuyen-nganh/nganh-vat-lieu-xay-dung/
Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
These are **design references**, not evidence that those systems use TIEN404's architecture.

## Exact local QA command

Run from repository root:
    node --test experiments/v18-7-industry/tests/qa-engine.test.cjs

Tests are offline and require Node.js >= 20. No npm install, DB, login or network required. All QA records use SYNTHETIC_QA.

## Store Customization UI (no live integration)

Open mock-builder.html for an isolated mobile-first UX preview. It uses no fetch(), credential, localStorage or backend. It never shows a green "connected" status. It is NOT an authenticated Customer Dashboard or a real channel connection.

Recommended customer setup: select industry -> configure store -> add structured product data -> connect channel -> preview -> apply after approvals.

## Schema / migration preview (NOT executed)

Precondition P0: verify/create the canonical stores authority and store membership model under separate owner approval. Existing public.tenant_memberships is **tenant** scoped; do not assume it proves store ownership.

Candidate entities:
- industry_profiles (id, version, stage, schema_version, profile_json, checksum, created_at), unique(id,version)
- store_profile_bindings (tenant_id, store_id, profile_id, profile_version, config_version, status, approved_by), FK to canonical (tenant_id,store_id) and profile version
- store_profile_overrides (tenant_id, store_id, config_version, override_json, effective_from), composite FK and strict write authorization
- store_knowledge_registry (tenant_id, store_id, knowledge_version, content_refs, status), no secret content
- store_profile_audit (actor_user_id, tenant_id, store_id, event_type, old_version, new_version, created_at)
Store/version associations should use composite foreign keys and unique constraints; never bare store names. Do not store tokens or real sensitive customer data in profile_json.

RLS and permissions must be designed for real store membership, not only TO authenticated. Avoid public SECURITY DEFINER, unguarded views, and user_metadata authorization. Use an unexposed private schema for internal audit/secrets. Owner/manager changes require server-verified store authority; INSERT/UPDATE must include tenant/store WITH CHECK.

This is a **schema design preview**, not an SQL migration. No Supabase tables or policies were changed.

## Tool policy / rollout

QA simulation exposes only read tools: search_products, read_price, check_inventory, preview_quote. No create_order, update_order, update_debt, provider_send, read_private_order, or admin_action.
Mode: MOCK; canWrite=false; canSend=false; no real data.

V18.7.1 -> contract, schema, offline negative QA.
V18.7.2 -> Grocery + Building Materials sample profiles, exact integer unit conversion.
V18.7.3 -> standalone mock customization UI; real authenticated UI is PENDING.
V18.7.4 -> future read-only industry adapter; blocked on real canonical store authority.
V18.7.5 -> Messenger/Zalo/Website mock capability tests.
V18.7.6 -> real Owner A/B JWT RLS UAT requires separate explicit authorization and evidence.
V18.7.7 -> release readiness review; production NO_GO.

## Limitations (must not overclaim)

No fractional unit conversions in V1. Decimal kg/m2/m3 requires approved exact decimal/rational precision design; prototype rejects fractions instead of rounding silently.
QA actor keys are obviously **not authentication**; their lookup is only a fake authority fixture. A production adapter MUST verify a server-validated principal and store ownership, channel installation, customer binding and tool scope; never reuse this QA lookup as auth.
No provider send, no Meta/Zalo OAuth, no n8n integration, no deployed authenticated Dashboard, no real order read/write.

## Legacy decision matrix

KEEP: Published Messenger, Commerce Core, Auth, Customer Dashboard, Billing and existing QA evidence.
ADAPT LATER: hard-coded Page credentials, DEMO tools and duplicated industry-specific prompt content after dependency and version audit.
DEPRECATE ONLY AFTER CUTOVER QA: manually copied workflows / obsolete channel UI when confirmed redundant.
REMOVE: none authorized.

Rollback: close Draft PR / revert isolated branch; no DB or credential rollback because none modified. Never merge without owner approval.
