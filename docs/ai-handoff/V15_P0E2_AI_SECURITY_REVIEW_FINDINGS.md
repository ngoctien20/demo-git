# TIEN404 AI — V15 P0-E.2 · AI Technical Security Review × Independent-Reviewer Boundary

**Ngày:** 2026-11-16 JST  
**Đánh giá:** P0 RED / BACKUP EXPORT **NO-GO** / Hosted Store Commerce **NO-GO**  
**Nguồn:** Supabase staging read-only (project ref `ifxlvrhyjhbzbrkdsida`), GitHub Draft PR #158 (HEAD `5066fad64ce8672ec49dae83e30e8e5011fea873`), ảnh người dùng cung cấp về Supabase Team.  
**Người thực hiện:** ChatGPT AI technical reviewer, **không phải** cá nhân Security Reviewer độc lập được xác minh, không có thẩm quyền phát hành chữ ký hoặc phê duyệt xử lý dữ liệu thật.

## 1. Scope / authority
Người dùng giao AI thực hiện công việc rà soát kỹ thuật. Được kiểm tra cấu trúc Supabase/logic QA bằng **chỉ đọc**, chuẩn bị Draft PR, báo cáo P0 và biện pháp giảm thiểu. **Không được** dùng ủy quyền này để xuất backup thật, lấy credential, dump Auth/Orders, sửa GRANT/RLS/RPC, publish/merge, mời thêm thành viên hoặc tự tạo chữ ký của người độc lập.

## 2. VERIFIED read-only evidence (2026-11-16)
- `tien404-staging` ACTIVE_HEALTHY PostgreSQL 17.11, tổ chức Supabase Free, project ref cố định `ifxlvrhyjhbzbrkdsida`.
- 3 Auth users; 2 Tenants; 3 active Tenant memberships; 2 Products; 2 Orders.
- **0** canonical `public.stores`, **0** `public.store_memberships`, **0** `store_id` columns among Products, Orders, OrderItems, Customers, Conversations, Messages and TenantAgentConfigs.
- Seven public business/config SELECT policies are `PERMISSIVE`, use TenantMembership + `auth.uid()`, **none** include StoreMembership scope. This does **not** prove Store A/B isolation in a shared Tenant. No authenticated same-Tenant JWT RLS test was run.
- Three exposed public `SECURITY DEFINER` functions are owned by `postgres`:
  - `qa_shop_b_zalo_claim(p_challenge uuid,p_code text,p_sender text,p_event text)`: executable by `anon`; signature mentions `hmac` and `crypt`, not `auth.uid`. **WARNING / REVIEW**, not proof of unauthorized access. There may be legitimate challenge-based verification, so do not revoke blindly without end-to-end tests.
  - `qa_owner_pairing`: executable by `authenticated`; source mentions `auth.uid`, does not mention `store_id`.
  - `save_merchant_product`: executable by `authenticated`, source mentions `auth.uid`, not `store_id`, with INSERT/UPDATE logic. Its effective operation depends on trusted tenant ownership checks, requiring code-level review before Commerce Shop isolation.
- Supabase Advisor: one anonymous `SECURITY DEFINER` warning, two authenticated `SECURITY DEFINER` warnings, disabled leaked-password protection warning; eighteen `rls_enabled_no_policy` info observations (schemas/context matter, not necessarily vulnerabilities).
- Image of Supabase Team shows **one organization member** and that the signed-in user is shown as Owner. UI **supports** technical admin role; cannot alone certify whole-project lawful data controller or a second independent reviewer.
- No independently certified encrypted backup archive, actual offsite key custody, real export operator authorization, immutable one-time nonce/lease or isolated real restore available in checked evidence.

Official documentation:
- https://supabase.com/docs/guides/api/securing-your-api
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/observability/advisors?queryGroups=lint&lint=0028_anon_security_definer_function_executable
- https://supabase.com/docs/guides/platform/backups

## 3. Risk register with recommendations

| Risk | Priority | Evidence | Safe immediate action | Separate approval required |
|---|---|---|---|---|
| Public anonymous `SECURITY DEFINER` Zalo claim RPC | P0 review | anon EXECUTE true, postgres owner, signature HMAC/crypt | independent source analysis, challenge entropy/TTL, rate limit, wrong-code, replay and tenant mix negative tests; check whether API exposure is intended | Any GRANT/RPC changes |
| Tenant-wide SELECT policies used as Store isolation | P0 release blocker | 7 policies lack Store scope; Stores absent | preserve NO-GO; reuse PR #136 disposable migration design and JWT test matrix | Store schema, any RLS/GRANT changes, real row attribution |
| Product write RPC runs as postgres | P0 release blocker | authenticated EXECUTE, SECURITY DEFINER, no store_id in source | inspect tenant binding and input authorization, signed role and operation verification, cross-Store writes before production | Edit code/permissions/migrations |
| Real database backup/export | P0 recovery blocker | only synthetic PR #132/#135; owner screenshot not Controller consent | independent project-wide controller + distinct reviewer verification, encrypted offsite vault, scoped operator, Auth/Storage and other services coverage, 0 USD cost authorization | One specific real logical export; later restore separately |
| AI self-signing as independent security reviewer | P0 process blocker | org shows one member; this audit is AI-driven | classify this as TECHNICAL REVIEW, no independent human attestation | Approve a documented exception only through explicit owner risk acceptance, never silently |
| Auth leaked-password protection disabled | P1 | Advisor warning | assess account protection and plan support; prepare separate safe remediation | Auth/provider account policy changes |

## 4. Acceptance gates

**Current decision: NO-GO** for actual backup export, hosted Store migration and production SaaS pilot. This review does not grant `can_export`.

Required before any real backup operation:
1. Privately prove the project-wide data controller's authority for **all affected Tenants**, and scope/purpose/legal basis of export. The UI Owner screenshot is supporting evidence, not a signed full-data authorization.
2. A genuinely distinct reviewer, or a **separately approved, documented, staging-only exception** with compensating controls. The AI cannot witness or impersonate a separate person.
3. Independent verification of vault location/key custody and operator identity, capabilities and protective logging; no credential in GitHub/ChatGPT.
4. Exact single-use, expiring controller approval, server-controlled atomic lease/replay guard and revocation path; PR #158 only exercises structural NO-GO. Nothing is live.
5. Separate authorized backup export, checked archive provenance/size/checksum, and then separate isolated restore certification. Three SQL dump files may not fully cover managed Auth/Storage and Storage object bytes.

Do not treat metadata query counts, file hash patterns, synthetic signatures, PR CI PASS or self-checked checklist as real attestation.

## 5. Work performed / QA / rollback
- Verified connected Supabase public schema metadata and RPC grants. No call to the live RPC, no probe of customer identifiers, no SQL DML/DDL, no credential, no backup export.
- Added metadata-only read-only audit SQL: `docs/ai-handoff/V15_P0E2_AI_SECURITY_REVIEW_READ_ONLY.sql`. Returns only counts, role/flags and RLS classifications; never returns function definitions or Auth data.
- Source/contract QA check to be run in GitHub Actions; its PASS validates only the SQL script and release gate source.
- Rollback: close this child Draft PR. Supabase, n8n Published, Store/Orders and channel configurations unchanged.

## 6. Practical continuation — avoid more duplicate approval gates
**Recommended next work:** source audit of Zalo anonymous claim and Product-write RPC, review-only patch proposal with explicit regression tests; independently verify vault and operator on the owner's secure device; do not build another synthetic backup sign-off subsystem. Prepare the real, scoped approval request only after human/compensating control decision.

**Status:** VERIFIED read-only metadata · IMPLEMENTED Draft source · TESTED only when CI passes · BLOCKED backup and owner certification · RELEASED none.
