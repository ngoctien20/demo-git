# TIEN404 V13.5 — FOUR-LEVEL ROLE AND PERMISSION MATRIX

**Status:** PROPOSED backend contract and isolated DRY_RUN code; **NOT live Staff/Admin/Owner role provisioning**.

| Action | Platform Owner | Platform Admin | TIEN404 Staff | Customer shop user |
|---|---|---|---|---|
| View own shop orders | Only via separately authorized lawful service access | Only purpose-bound support | Only assigned ticket + verified support scope | owner/manager + active membership + RLS |
| Update order status | Approval/audit as required | Delegated case approval only | Never by default | Future authorized owner workflow only |
| Manage product/price/stock | Oversight | Delegated | Shop assignment + approval/audit | No |
| Change bot/prompt/menu | Release oversight | Review | Assigned staff + release gate | Request customization (Plus), no direct editor |
| View own subscription/profile | Not via global secret bypass | Authorized workflow | Assigned customer support only | Yes, source verified |
| Manage users/staff assignments | MFA & audit | Scoped assignment proposal | No | No |
| Grant Platform Owner / change MFA | Recovery process only | No | No | No |
| Zalo OA / Messenger send | No direct unconditional send | Review only | Authorized testing gate | No direct API send |
| System security/release | Fresh MFA + audit and approval | Cannot self-promote | Cannot self-promote | No |
| Read raw passwords/tokens/CVV | **Never** | **Never** | **Never** | **Never** |

**Trust chain:** Authenticated session -> independent platform role -> server-verified tenant/store -> active shop membership OR staff assignment -> verified subscription/enterprise contract -> action permit -> backend business gate -> audit. Merchant membership role `owner` is **not** PLATFORM_OWNER.

**Implemented code:** `qa/v135/platform-role-contract.cjs`. It uses injected verified backend ports and returns DRY_RUN decisions only (no writes, no role grants). Staff actions require a *separate* assigned-shop proof; owner release preparation requires reauthentication and MFA proof. Missing roles, subscriptions, assignment or scope fail closed.

**Blocked:** No canonical Supabase platform_staff_assignments, platform_roles or commercial subscription authority confirmed. Existing `tien404_tester_staff` serves a **Tester QA domain**, not production Staff Console. Do not reuse implicitly or grant roles through browser labels.
