# TIEN404 V13.3 — Supabase Auth/RLS Security Read-only Audit

Date: 2026-11-15 JST. Project: tien404-staging (ifxlvrhyjhbzbrkdsida). No SQL writes/migrations/RLS grants performed.

## Verified

- Project ACTIVE_HEALTHY.
- public.tenants, public.tenant_memberships and public.orders have RLS enabled.
- Policies observed: memberships_self_read uses auth.uid() and active membership; tenants_member_read requires active membership; orders_manager_read requires active owner/manager membership in same tenant. These are structural predicates, NOT hosted authenticated Shop A/B end-to-end evidence.
- No authenticated merchant GET /api/sales-lite/me endpoint was independently confirmed. The V13.3 resolver is an injected server-only code candidate, not deployed.
- Security Advisor warnings (as of 2026-11-15T03:11Z): public qa_shop_b_zalo_claim SECURITY DEFINER executable by anon; qa_owner_pairing and save_merchant_product SECURITY DEFINER executable by authenticated. Auth leaked password protection disabled. Private-schema RLS-without-policies findings are INFO and may be intentional backend-only design.
- Verified function privileges via pg_proc and has_function_privilege: qa_shop_b_zalo_claim has EXECUTE for anon and not authenticated; qa_owner_pairing/save_merchant_product are executable by authenticated but not anon.

## Specific qa_shop_b_zalo_claim risk assessment

Read-only pg_get_functiondef shows that the function:
1. Is SECURITY DEFINER in public.
2. Requires a secret value from a custom request header, compares its SHA-256 digest against Vault-derived secret; rejects missing/mismatched header.
3. Uses explicit empty search_path and a fixed synthetic QA Shop B tenant/store/bot scope.
4. Returns a boolean, with parameter constraints and a call to a QA-specific pairing function.

Therefore an anonymous call **without the secret** is designed to be denied. No exploitation or secret compromise was tested. However EXECUTE by anon on a privileged public RPC is a risky surface if that header secret is leaked or the caller path is compromised. The warning is a **P0 review/release gate**, not proof of a live compromise.

## Required approval-gated remediation plan (NOT APPLIED)

- Confirm all current n8n/Cloudflare/Render QA routes that invoke qa_shop_b_zalo_claim and their caller auth method; save snapshots.
- Prepare least-privilege server-only RPC alternative or protected service-side call. Validate no cross-tenant mutation and expiry/nonce/replay protections.
- After migration and explicit authorization, consider revoking anon EXECUTE for the legacy QA function.
- Capture before/after role privilege readback, synthetic pairing QA and rollback.
- Separately audit current grants and ownership checks in qa_owner_pairing and save_merchant_product; do not revoke blindly.
- Evaluate enabling Supabase leaked-password protection after reviewing existing Auth/password setup.
- Perform hosted JWT/session/RLS QA with real valid/revoked/unrelated accounts; no user access tokens stored in frontend or logs.

## Source

Supabase Advisor: https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable
Supabase Auth: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

**State:** VERIFIED read-only audit / PROPOSED remediation / BLOCKED hosted E2E. No production or credential changes.
