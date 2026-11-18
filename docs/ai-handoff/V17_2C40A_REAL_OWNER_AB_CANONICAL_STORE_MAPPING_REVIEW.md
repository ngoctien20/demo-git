# TIEN404 AI — V17.2C.40A Canonical Store Authority Admission × Real Owner A/B Mapping Review

**Date:** 2026-11-18 (JST). **Mode:** metadata/aggregate-only READ on live Supabase staging + QA-only n8n registry rows + GitHub DRAFT source commit. **Parent:** V17.2C.40 checkpoint `7e3f8b212de32e76308942ff7c8a11b474776ebd`, Draft PR #392. **Decision:** Real Store A/B authorization closure BLOCKED; no release.

## 1. Strict permissions and scope
- Direct evidence from connected `tien404-staging` Supabase project `ifxlvrhyjhbzbrkdsida` (Postgres 17, ACTIVE_HEALTHY); existing dev branches count 0.
- Queried only schema metadata and count/aggregate presence of Auth/Tenant/QA Store records. Did **not** read user email, phone, password, JWT, Auth session payload, customer identity, private receipts, order data, credential or provider token values.
- Read existing n8n DataTable QA rows for **sanitized aggregates and string equality comparisons only**, never outputs of recipient/account IDs or credential_refs. Read-only; did not execute/publish/update workflows.
- Explicitly NO new Supabase branches, DDL/DML, product/order modifications, security grant edits, live Messenger/Zalo sends or credential changes. GitHub artifacts are source-only audit documents; no migration.

## 2. VERIFIED live Owner–Tenant structure (aggregate only)
- Live `public.tenants`: **2** tenants; `auth.users`: **3** users; `public.tenant_memberships`: **3** active owners by 3 distinct users; 0 inactive.
- **Tenant Group T1**: 2 distinct active owner users (0 manager/staff), **1 QA Store** associated via `tien404_r1_qa.tenant_identity_map`.
- **Tenant Group T2**: 1 distinct active owner user, **1 QA Store** associated via QA mapping.
- T1/T2 are **local report aliases based on aggregate owner count**, not permanent Store names or source UUIDs; no raw IDs persisted in this report.
- **Meaning:** 2 Owner accounts in T1 may be co-owners of ONE Store. This is **not** evidence of Owner A/Store A and Owner B/Store B membership. Real two-Store, same-tenant A/B probes cannot yet proceed.

## 3. QA registry provenance observed (never promoted to production authority)
- `tien404_r1_qa.shop_bots`: **2** rows, both `enabled_mode=dry_run`, `identity_status=synthetic_qa`.
- `tien404_r1_qa.tenant_identity_map`: **2** rows; each matches one existing real `public.tenants.id`. This verifies a QA-to-Tenant **reference**, not a privileged Store membership.
- `tien404_r1_qa.owner_bindings`: **2** rows currently `status=paired` and unexpired. **Only 1/2** has a non-null confirmed challenge ID joining a confirmed pairing claim, consumed challenge and active `tenant_memberships` owner requester. The other binding lacks this entire confirmed challenge lineage via the current schema. It may be an older/alternative pairing path; this is missing provenance, not proof of wrongdoing.
- QA pairing claims: **3 CONFIRMED**, **1 PENDING_OWNER_CONFIRMATION**. Confirmation count of all claims is **NOT** equivalent to the two current owner bindings' valid authorization proofs.
- `tien404_v175_qa.channel_identity`: 0; `auth_customer_binding`: 0; `order_ownership`: 0. `tien404_dialogue_private.shop_b_sessions`: 0. These are **QA schemas**, not the real customer production authority.
- Actual canonical `public.stores` and `public.store_memberships`: **not present**. Commerce Orders/OrderItems/Products/Customers have **no `store_id`**; Orders RLS is tenant-wide. `app_private.channel_secrets`: 0 rows and no Store scope.

## 4. VERIFIED n8n DataTable registry cross-check — sanitized
- `TIEN404_R1_SHOP_BOT_REGISTRY_QA`: 2 rows, 2 distinct QA Tenant keys, 2 distinct Store keys; all `dry_run` / `synthetic_qa`; provider `zalo_bot_fixture`.
- **Exact-string key comparison** `(tenant_id,store_id,bot_id)` from this n8n QA registry versus `(tenant_key,store_key,bot_key)` from Supabase `tien404_r1_qa.shop_bots`: **0/2 exact tuples match**. The namespace/alias representation may intentionally differ; no approved resolver or signed translation proof was found. **Do not auto-join by name or guess IDs.**
- `TIEN404_COMMERCE_CHANNELS`: 6 rows across 4 distinct n8n Tenant keys; channel categories Messenger, Zalo OA, Website; 3 `enabled=true`, statuses `sandbox` or `not_connected`. Exact-string comparison to the 2 actual `public.tenants.id` UUIDs: **0/6 direct matches**, including 0/3 enabled channels. This is an **unproven mapping**, NOT evidence those channels are connected to real Supabase Commerce. It may be an alias scheme; verify trusted translation before any real send/write.
- `TIEN404_V171C_QA_INSTALLATION_BOT_BINDINGS_NO_SEND`: 3 rows, all `SYNTHETIC_ONLY` and read_only; 0 with `owner_authority_verified=true`; statuses `QA_APPROVED/REVOKED`. 
- `TIEN404_V172_QA_UNIFIED_CHANNEL_CUSTOM_BOT_PROFILES_NO_SEND`: 7 rows, all `SYNTHETIC_ONLY` and read_only; 0 with `owner_authority_verified=true`; statuses `QA_APPROVED/REVOKED`.
- These statuses are fixtures/regression controls. `QA_APPROVED` is NOT production authorization.

## 5. Actual live SQL admission gates — VERIFIED EXECUTION
Read-only SQL: `qa/v172c-rpc-closure/v172c40a-real-owner-ab-store-mapping-readonly-gates.sql` executed against connected Supabase and committed to existing Draft branch.
**15 total**: **3 VERIFIED_PASS**, **9 VERIFIED_BLOCKED**, **3 NOT_TESTED**.
- VERIFIED_PASS: `A01` 2 real distinct owners in same tenant exist; `Q01` all QA bots explicitly synthetic/dry-run; `Q02` QA bot registry has explicit FK-backed QA-only reference to existing tenants.
- VERIFIED_BLOCKED: `A02` 2 QA Stores under owner-pair Tenant absent; `A03` owner-binding confirmed challenge provenance incomplete; `S01` canonical Store/membership tables absent; `S02` Commerce `store_id` absent; `S03` Store-aware RLS unavailable / broad permissive tenant reads still present; `C01` Store-scoped real DB channel registration absent; `C02` protected QA channel identity zero; `C03` auth/customer proof zero; `C04` QA order ownership proof zero.
- NOT_TESTED: `M01` independent verified live Auth sessions/JWT A/B; `M02` current provider-signed installation receipt under Store authority; `M03` consent, independent reviewer and recovery/approval.
- **Interpretation:** PASS for QA isolation/foreign-key existence is **not** acceptance of real Auth Store A/B. Full production release gate remains NO-GO.

## 6. Proposed identity and admission mapping contract (NOT applied)
**Minimum actual protected mapping:**
1. `tenant_id`: verified immutable canonical tenant UUID from live `public.tenants`.
2. `store_id`: **new canonical UUID** after approval, owned by tenant, with unique `(tenant_id,store_id)` constraints. Legacy QA `store_key` is only an external alias, not automatically a canonical Store ID.
3. `store_memberships`: `(tenant_id,store_id,auth_user_id,role,active,provenance,verified_at)`, server-verified and reviewed. Two people in the same Tenant must not gain access to all Stores implicitly.
4. `channel_installations`: signed provider identity + trusted `(tenant_id,store_id,channel,installation_ref)` held in private protected service, with owner consent/status, replay and rotation. n8n `tenantId`, `store_id`, `bot_id` aliases require an explicitly audited translation and conflict/duplication checker.
5. `order.store_id` / Product / Customer / order_items lineage: mandatory for real multi-Store, with exact composite FK and RLS; any missing legacy provenance is quarantined, never guessed from sender/phone/LLM output.
6. Protected A/B read-only tests: only after two actual Stores bound within one Tenant and separately authorized real owner sessions, with A→A and B→B reads permitted and cross-Store A→B / B→A denied; verify revoked owners, forged order references, cross-tenant C and session expiry. Never paste JWT or credentials into GitHub/issues/chat.
7. **No promotion** of `dry_run` or `synthetic_qa` stores, `paired` labels lacking provenance, or `QA_APPROVED` flags to real store access.

## 7. Release risks and critical security notes
- **P1:** same-Tenant tenant-wide Orders RLS, even with 2 owners, cannot prove Store A/B isolation.
- **P1:** one QA owner binding lacks verified challenge→real owner chain. Requires historical alternate mechanism audit; cannot assert it is unauthorized without checking the original process.
- **P1:** n8n Commerce Channel and QA Bot ID namespaces cannot be directly joined by tuple/UUID. Alias resolution may be intentional but no authoritative resolver is verified. **Do not rewrite IDs or connect channels automatically.**
- **P1:** published legacy Messenger Google Sheets order writers remain tenant/store-unaware; V17.2C.40 already documented Draft≠Published versions. Do not couple these to canonical Commerce without separate release.
- **SECURITY:** Supabase security advisor previously flagged public `qa_shop_b_zalo_claim` (anon-executable SECURITY DEFINER), `qa_owner_pairing` and `save_merchant_product`. Separate security review and explicit approval needed before grants/flow changes.
- No source-level QA asserts live JWT Store negative PASS; no customer data touched, no live Order writes, no production notification.

## 8. Changes / rollback / checkpoint / next
- **VERIFIED:** live Auth aggregates, QA Store/bot/owner provenance, n8n registry sanitized counts and exact-key equivalence, and 15-item SQL gate on Supabase staging.
- **IMPLEMENTED:** the repeatable **SELECT-only** V17.2C.40A gate and this handoff document on the existing Draft PR #392. No hosted runtime changes.
- **TESTED:** live read-only introspection. Not tested: actual separate JWT A/B Store access, provider signatures, trusted tenant alias resolver, actual private Order reads.
- **PROPOSED:** signed source provenance, reviewed canonical two-Store membership model, an alias-mapping reconciliation matrix for provider/n8n/Supabase namespaces, and isolated safe migration after backup.
- **BLOCKED:** two canonical Store memberships in same Tenant, sufficient proof for both owner bindings, provider signed Store installation and real owner consent.
- **Approvals required:** explicit Store A/B owners+Store boundaries, consent for authenticated UAT, migration/backup/restore with independent review, any credentials or publish modifications and resource/fee changes.
- **Rollback:** revert only audit SQL/document source commits on Draft PR #392; no live Supabase/n8n rollback needed.
- **NEXT proposed:** V17.2C.40B — Owner-Approved Store A/B Authority Source Registry × Alias Conflict Matrix × No-Write Migration Plan. Do not request/use passwords or JWT in conversation.
