# TIEN404 AI — V17.2C.40B Alias Conflict Matrix (READ-ONLY, NO APPROVAL)

**Checkpoint:** 2026-11-18 JST. Evidence: direct live Supabase metadata/aggregate SELECT and read-only n8n DataTable schema/rows comparisons. Compare only *exact string equality*, which does NOT prove semantic identity when systems use different namespaces. Raw UUIDs, provider IDs, owner references, customer data and tokens intentionally omitted.

| Ref | Sources compared | Direct evidence | Classification | Admission requirement |
|---|---|---|---|---|
| AL-01 | n8n `TIEN404_COMMERCE_CHANNELS.tenantId` -> `TIEN404_COMMERCE_TENANTS.tenantId` | **6/6** channel records match a tenant in same n8n namespace; 4 distinct n8n tenants; 3 channels `enabled=true` | INTERNALLY_CONSISTENT_ONLY | Preserve internal n8n links; this does not confer Supabase Store authority |
| AL-02 | n8n `TIEN404_COMMERCE_TENANTS.tenantId` -> Supabase `public.tenants.id` | **0/4** exact direct UUID-string matches | UNRESOLVED_NAMESPACE_TRANSLATION | Owner-approved server-side crosswalk with evidence source/version, no automatic ID coercion |
| AL-03 | n8n Commerce channels -> Supabase `public.tenants.id` | **0/6** direct string matches (including **0/3** enabled). Connection statuses only `sandbox` or `not_connected` | NO_REAL_TENANT_CLAIM | Do not treat n8n `enabled` as live provider/Store proof |
| AL-04 | n8n `TIEN404_R1_SHOP_BOT_REGISTRY_QA` -> Supabase `tien404_r1_qa.shop_bots` via full `(tenant,store,bot)` tuple | **0/2** exact tuple matches; both sides contain **2** fixture rows | UNRESOLVED_QA_TUPLE_ALIAS | Verify each source's alias scheme and immutable registration evidence; no name/phone/LLM match |
| AL-05 | n8n `TIEN404_G05_QA_TRUSTED_INSTALLATION_REGISTRY_NO_SEND` -> n8n R1 QA Bot Registry by `(tenant,store)` | **7** installation fixture rows spanning **3** scopes, **0/7** direct Store tuple matches to the two R1 bot rows; all installation fixtures `QA_SYNTHETIC_NO_REAL_OWNER` | DISTINCT_QA_FIXTURES_UNPROVEN | Do not infer that two independent QA labs share live tenant/store namespace |
| OA-01 | Supabase active Tenant membership -> R1 QA Tenant/Store map | One Tenant has **2 distinct active owner accounts** but just **1 QA Store**; other Tenant has **1 owner/1 QA Store** | STORE_AB_NOT_ESTABLISHED | Owner explicitly decides whether these are co-owners of one Store or separate Store A/B under same Tenant |
| OA-02 | `tien404_r1_qa.owner_bindings` -> confirmed claim -> consumed challenge -> active Auth tenant owner | **2/2** bindings carry `paired` and unexpired status, but **1/2** has complete current proof chain | PARTIAL_PROVENANCE | Audit historical alternate pairing; do not silently promote the incomplete binding |
| CH-01 | n8n `TIEN404_V171C_QA_INSTALLATION_BOT_BINDINGS_NO_SEND` | **3/3** read_only, `SYNTHETIC_ONLY`, 0 with `owner_authority_verified=true` | QA_ONLY | Distinct real provider receipt + trusted binding required |
| CH-02 | n8n `TIEN404_V172_QA_UNIFIED_CHANNEL_CUSTOM_BOT_PROFILES_NO_SEND` | **7/7** read_only, `SYNTHETIC_ONLY`, 0 with `owner_authority_verified=true` | QA_ONLY | Cannot be promoted by changing a status label |
| CH-03 | Supabase `app_private.channel_secrets` -> real channel registration | **0** rows, table has no `store_id` | CANONICAL_CHANNEL_NOT_ADMITTED | Protect installation-to-(tenant,store,channel) mapping in private backend only |
| ST-01 | Supabase Commerce Orders/Items/Products/Customers -> canonical Store | `public.stores` and `public.store_memberships` missing; four Commerce tables lack `store_id`; broad tenant SELECT RLS persists | BLOCKING_SCHEMA | Approved expand-migration + tenant/Store FK + atomic RLS cutover with independent Auth tests |

## Semantics and collision matrix

- **Exact alias match across sources**: necessary only when both use the *same declared namespace*; it is not sufficient for authority without provider/owner proof. Different aliases may represent the same entity or entirely separate QA fixtures; treat as UNKNOWN until provenance is independently signed.
- **Many aliases → one canonical Tenant**: may be legitimate, but each alias must have unique namespace + exact origin + allowed scope. Block duplicate ambiguous claims.
- **One provider installation → multiple Store claims**: DENY by default unless a separately designed and approved multi-Store account routing model handles authorization per interaction. Never let the incoming message select Store freely.
- **One owner → multiple Store memberships**: allowed only via independently approved explicit Store grants. A tenant-level owner does not automatically own every Store.
- **Two owners → one Store**: legitimate co-owner model; cannot use it as evidence for cross-Store A/B negative QA.
- **One legacy order without Store provenance**: quarantine in compatibility lane; no Store inference from `phone`, `sender_id`, SKU, text or primary key.
- **Changes in alias/owner/provider installation**: require revisioned provenance, conflict/replay checks, revocation, audit trail and fresh verified session. No direct change to any Published path based on this matrix.

## Severity and next admission

**P1 BLOCKED**: AL-02/03/04, OA-01/02, CH-03, ST-01. The internally consistent n8n tenant list (AL-01) is not a live Supabase identity resolver. AL-05 could be separate QA fixtures; it is not evidence of a production conflict or compromise.

**MUST NOT STORE**: real JWT, user email/phone, credentialRef/token values, provider sender identity, unredacted channel account IDs or exact owner approval artifacts in this GitHub report. Keep authorization evidence in future private auditable server-side registry after explicit approval.

**Release status:** `NO-GO` for Store-scoped Orders, real A/B UAT, channel writer integration and any provider dispatch. No live writes were executed.
