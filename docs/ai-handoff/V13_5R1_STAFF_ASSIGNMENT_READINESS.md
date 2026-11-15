# TIEN404 AI V13.5R.1 — Staff Assignment / Platform Role Readiness

**Stage:** PROPOSED, backend disconnected. No role or permission has been granted.

## VERIFIED
- In inspected Supabase schemas `public` and `app_private`, only `public.tien404_tester_staff` and `public.tien404_tester_assignments` match staff/assignment naming. **Tester grants must not become production TIEN404 Staff privileges.**
- `public.tenant_memberships` stores `tenant_id`, `user_id`, `role`, `active`. Its `owner` role is a merchant role, **not** Platform Owner. `public.stores`, commercial `platform_roles`, `staff_assignments`, `subscriptions` were not confirmed as authoritative tables in these schemas.
- `qa/v135/platform-role-contract.cjs` already models four roles (CUSTOMER / TIEN404_STAFF / PLATFORM_ADMIN / PLATFORM_OWNER) with dedicated `readPlatformRole`, `readStaffAssignment`, `readOwnerApproval`, and `readEntitlement` server ports. It is DRY_RUN_ONLY, not a production authorizer.
- Existing Auth Preview build uses Supabase Auth, not a separate TIEN404 Staff login.

## Proposed canonical backend split (NO DDL applied)
1. **Platform identity registry:** user ID from verified Supabase Auth; platform role stored in a separate server-controlled registry, **never client `user_metadata` or shop `tenant_memberships`**.
2. **Shop assignment:** `staff_user_id`, `tenant_id`, verified `store_id` when a store registry exists, capability list, `active`, `expires_at`, `approved_by`, `revoked_at`, `assignment_version`, ticket/change reason.
3. **Least privilege:** staff only gets explicit assigned shop and action, not platform-wide ability to browse all customers/products. No raw bot tokens, passwords or payment credentials.
4. **Owner approval:** Platform Owner elevation requires privileged server-side claim, fresh MFA / reauthentication and audited approval reference; Admin cannot grant itself Owner.
5. **Audit:** all staff reads/writes that access customer information require purpose/assignment and appropriate events. High-risk operations require independent approval.
6. **Subscriptions:** separate authoritative subscription data source; missing/expired state fails closed for paid operations but should not prevent profile/security access.
7. **Multi-store:** current tenant-based RLS is not proof of store-level separation; implement/verify `stores` and staff assignment semantics before claiming multi-branch production readiness.

## Test matrix before activation
- Shop owner attempting Staff Bot menu -> DENY.
- Tester staff attempting commercial Staff/API -> DENY.
- Revoked, expired, unassigned Staff -> DENY.
- Staff assigned Shop A attempts Shop B -> DENY.
- Shop Staff requests UPDATE Orders/payment/price without separate permission -> DENY.
- Admin attempts Platform Owner grant -> DENY.
- Owner high-risk action without fresh MFA approval -> DENY.
- Auth user of another tenant asking staff routes -> DENY.
- Audit log records approved operational access without credentials.
- Cross-store/tenant real hosted RLS negative proof.

**Implementation authority:** Create a separate reviewed SQL migration and explicit owner approval before tables, ACL, RLS policies, service role grants, bootstrap Platform Owner account, or staff assignments are written. No fake "approved" role should appear in UI until backend evidence exists.

## Current safe next step
Use existing authenticated customer portal for Shop A/B read-only testing. Independently review Staff role schema and API contract in a new Draft, then run signed-session negative QA before any Staff Console integration.

## Rollback
This file is design-only. Remove by reverting Draft PR #81; no database changes to restore.
