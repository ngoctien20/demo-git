# TIEN404 AI — V15 Sales Lite P0-H
## Real Channel/Store Evidence Mapping × Hosted Read-Only Preflight

**Ngày:** 2026-11-16 JST  
**Parent:** Draft PR #181 at `838ef70acf45e51b0ea0106ea1354fe92fc81a07`  
**Quyết định:** **NO-GO real Commerce read-only pilot**, source-only implementation, actual hosted metadata inspection **VERIFIED**.  
**Tuyệt đối không:** xuất secrets, backup, SQL DDL/DML, GRANT/RLS/RPC, n8n Published changes, Meta/Zalo sends, Orders writes, paid models or merge.

## A. Actual preflight — VERIFIED on connected Supabase staging

**Target:** `tien404-staging` / `ifxlvrhyjhbzbrkdsida`.

`docs/ai-handoff/V15_P0H_HOSTED_METADATA_ONLY_PREFLIGHT.sql` was **actually executed** on the hosted project with `BEGIN TRANSACTION READ ONLY;` and `COMMIT;`. The output contains aggregate counts and PostgreSQL metadata only; it does **not** contain user IDs, account references, owner names, recipients, raw customer data, credential IDs/values, JWT, email or phone.

Recorded exact **non-sensitive aggregate** in `qa/v15-sales-lite-p0h/hosted-observed-metadata-20261116.json`:

| Measure | Actual observed value | Interpretation |
| --- | ---: | --- |
| Tenant / active Tenant membership | 2 / 3 | Tenant membership alone is not Store ownership |
| Products / Orders | 2 / 2 | Actual rows exist but have no canonical Store scope |
| `app_private.channel_secrets` account-binding rows | **0** | **No hosted provider account evidence** in this registry |
| `public.tenant_agent_configs` | 1, and all 1 are `pilot_lab` | Preview config is not a published native Messenger/Zalo binding |
| `tien404_r1_qa.shop_bots` | 2 / 2 flagged `synthetic_qa` | QA bot identities explicitly are *not* real provider authority |
| `tien404_r1_qa.tenant_identity_map` | 2 | QA bridge only, not canonical Store ownership |
| `public.stores`, `public.store_memberships` | **0 / 0 tables** | Canonical Store authorization cannot currently be certified |
| `public.products.store_id` / `public.orders.store_id` | **0 / 0 columns** | Cannot scope real price/order rows by Store |
| Products tenant RLS / Store RLS policy | 1 / **0** | Tenant-scoped permission is not same-Tenant Shop A/B isolation |
| Private `channel_secrets` table RLS | Enabled | Good isolation mechanism, not owner attestation |
| Private table SELECT to `anon` or `authenticated` | false / false | No direct client SELECT, but not a proof that privileged paths cannot bypass |
| Duplicate provider account refs / orphan Tenant refs | 0 / 0 | Vacuous when registry empty; not proof of correct mapping |

**Existing production-design constraints matter:**
- `app_private.channel_secrets` has PK **`(tenant_id, platform)`**. This allows at most one provider-account record per platform per Tenant in this table and cannot encode multiple same-platform Store accounts for one Tenant without a separately reviewed schema change. Unique **`(platform, external_account_ref)`** exists, and `secret_ref` must be Vault-style, but there are **zero** rows. Do not add entries or use Vault values without approval.
- `public.tenant_agent_configs` has PK **`(tenant_id, channel)`**, and a database CHECK limits `channel` to `pilot_lab`; it has no Store ID. Not a multistore channel registry.
- QA `shop_bots` has a DB CHECK forcing `identity_status='synthetic_qa'`, and only `dry_run|disabled` mode. Do not use its owner/pairing records as live provider consent.
- `products` still has UNIQUE `(tenant_id,sku)`, preventing two same-Tenant Stores from independently storing identical SKU with different prices. Releasing new Store-scoped write/read without handling this constraint is unsafe.
- `app_private.channel_secrets` RLS and absence of anon/auth SELECT is beneficial defense but privileged postgres/SECURITY DEFINER paths need independent review.

## B. Read-only n8n verified state
Inspected node names/types and active/version metadata, **not secrets**:

| Workflow | Version / state | Readiness |
| --- | --- | --- |
| `TIEN404_MESSENGER_TEST` `Z7FdV7uDvApfbURQ` | active, `d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92` | Uses Google Sheets DEMO catalog and legacy DEMO order tools; cannot be claimed as authorized Commerce |
| `TIEN404_COMMERCE_AI_AGENT_SANDBOX` `iyfGUiEsZlNTBWOR` | inactive, `ddc3ce5b-365e-47e2-a06d-08daffceb9a8` | Synthetic Commerce lab |
| `TIEN404_COMMERCE_SHOP_ONBOARDING` `splyaeQtV719OuAu` | active, `ae8f65de-4325-4e83-97be-4945a3abaffd` | n8n Data Tables, not canonical Supabase Store |
| `TIEN404_ZALO_BOT_LAB_V1_STAGING` `yIJk8LvJoLF40Z62` | active, `8ca4a6f6-ab3f-42f1-8637-d4f5db790a3e` | Protected QA ACK No Message Sent; does not certify native provider ownership |

No Published workflow rewiring, no provider sends, no execution replay or webhook response triggered.

## C. Actual deliverables, no fake certification
- `docs/ai-handoff/V15_P0H_HOSTED_METADATA_ONLY_PREFLIGHT.sql`: safely repeatable, aggregate-only hosted SELECT in read-only transaction.
- `qa/v15-sales-lite-p0h/hosted-observed-metadata-20261116.json`: **real observed** project aggregates + source and date, not privately identifiable rows.
- `qa/v15-sales-lite-p0h/hosted-channel-store-metadata-preflight.cjs`: derived diagnostic of structural blockers; never issues a live read, Order, provider or migration authorization. Even hypothetical perfect *metadata* yields `NO_GO` because provider signature, Store ownership, JWT/RLS and approval must be independently checked in private.
- `qa/v15-sales-lite-p0h/hosted-channel-store-metadata-preflight.test.cjs`: asserts real-observed blockers plus malicious/self-claimed approval, PII/secret injection, missing Store, duplicate account ref, orphan Tenant, unsafe client grants and future-looking "metadata complete" cannot be promoted to proof.
- `qa/v15-sales-lite-p0h/hosted-preflight-sql-source-contract.test.cjs`: verifies read-only SQL, aggregate outputs and no secret, data or metadata values leaked.
- GitHub Actions isolated offline regression and inherited P0-G/P0-F tests.

## D. Target REAL Channel → canonical Store binding — PROPOSED ONLY

Do NOT implement on hosted without specific separate project Owner + security authorization, real backup/restore and versioned migration.

**Authorized future identity chain:**
1. Native ingress verifies **Meta HMAC / Zalo official provider signature** or server-issued Website Widget session; the provider account/page/OA ID comes from that verified source, never from customer message, prompt, URL query, `user_metadata` or LLM.
2. Trusted backend resolves **`(platform, provider_account_ref)`** to **exactly one active, owner-consented `(tenant_id, store_id, channel_binding_version)`** through a private trusted channel registry. Repeated/ambiguous/unverified/revoked mappings must fail closed.
3. Backend verifies Store status active and independently attested merchant consent, tenant+Store membership (where principal is the merchant), scoped capability, request freshness/idempotent replay and domain/channel association.
4. Customer chatbot is *not* impersonating a merchant Supabase JWT; a least-privileged channel-bound server reader must have an explicitly reviewed authorization model. **No shared global `service_role`** or untrusted Store ID in SQL.
5. Commerce read requires explicit `tenant_id + store_id + sku`, composite Store FK and appropriate RLS/grants; product price/stock from authoritative row and version, not LLM, spreadsheet DEMO or QA fixture. Do not leak user/owner data to the chatbot.
6. Return only a **server-side quote preview**, with `can_send=false`, `can_create_order=false`, `owner_alerts=0` until new release approval. Provider reply SEND remains separate from secure read.

**Proposed future schema only:** `channel_bindings` keyed with `(platform, provider_account_ref)` UNIQUE, `(tenant_id,store_id)` FK to canonical Store, `status` and consent/evidence timestamps, version and typed channel. For multiple Stores per Tenant and channel, design constraints/ownership carefully. `app_private.channel_secrets` continues to hold Vault references only; do not mix secrets into public UI or move them into the new registry without review.

## E. P0 release blockers and approval
| Real evidence | Status |
| --- | --- |
| Host read-only schema/counts/privileges | **VERIFIED** |
| Real provider channel registry rows | **0 — BLOCKED** |
| Canonical Tenant/Store membership and JWT/RLS | **BLOCKED** |
| Native Meta/Zalo verified provider identity + merchant consent | **BLOCKED** |
| Private Controller/Reviewer, real backup + independent restore | **BLOCKED** |
| Hosted Store migration and tenant-to-store legacy attribution | **NOT APPROVED** |
| Authoritative store-price read under least privilege | **NOT IMPLEMENTED** |
| Real Messenger/Zalo send, Order + Outbox | **NO-GO** |

**Safe next action** is independent private owner/channel evidence collection and separately authorized safe backup/Store schema expansion, not more synthetic permissions. Support a read-only private proof checklist with actual references ONLY, never store credentials in PR.

## F. QA, rollback and checkpoint
Local QA and CI verify source and actual metadata aggregate snapshot only; they do not create real provider/JWT identity, read Commerce price from hosted, or authorize a pilot. Rollback source-only: close child Draft PR. No Supabase hosted data/schema, n8n Published, provider messages, credentials, billing or real orders were modified.

**Next milestone proposal:** `V15 Sales Lite P0-I — Real Merchant/Provider Ownership Proof × Backup-Gated Canonical Store Expand Decision`. This is a **decision** for an actual backed-up migration and read-only scope, not a command to apply it.
