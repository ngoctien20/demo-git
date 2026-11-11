# TIEN404 AI V4 — ADMIN_ARCHITECTURE

**Design + local staging implementation; Control Hub Sites source not accessible.** 2026-11-10.

## Preserve three distinct surfaces

1. **Public Website** `ngoctien20.github.io/demo-git/`: product information and approved knowledge, no customer secrets, no admin credentials. Current signup/checkout are browser simulations; AI marketing bot uses an isolated n8n workflow.
2. **Customer Dashboard**: tenant-scoped customer login, plans, usage, channels and bot controls; actual production backend not implemented.
3. **Super Admin**: prefer expanding existing `tien404-control-hub.fairflounder1.chatgpt.site` when its Sites source, session and D1 bindings can be inspected. Avoid creating a second privileged console.

```text
            GitHub Pages (public)        Existing Control Hub (privileged)
                   |                              |
                   | only approved data           | session + MFA + CSRF
                   v                              v
             Public API                   Secure server-side API
                  \                          /  |         |
                  approved knowledge /        |         |
                     D1/DB          Entitlement Gateway    Audit Log
                        |               |                 |
             Tenant memberships     Channel adapter     Approval gate
                        |               |                 |
                 Subscription       Signed provider      Version registry
                      state           webhooks           + bot QA
                                         |
                                    n8n isolated workflows
```

The staging reference under `app/` implements authentication, RBAC, sessions, subscription lifecycle, entitlement decisions, a signed internal QA check, approved knowledge, channel *metadata* and audit storage. It does **not** connect to Sites/D1, n8n, Messenger, payment or a live secret manager.

## Authority matrix — backend required

| Role | Platform tenants | Billing / pricing writes | Channel metadata | Read own tenant | Publish bot/knowledge |
|---|---|---|---|---|---|
| SUPER_ADMIN | all | allowed with recent MFA and audit | metadata only | all | approve knowledge only in staging; bot publish blocked |
| SUPPORT_ADMIN | tenant list | forbidden | read-only | support scope; PII restricted | forbidden |
| TECH_ADMIN | tenant list | forbidden | limited `vault://` metadata with MFA | technical scope | forbidden |
| STORE_OWNER | own by membership | forbidden | own metadata read | own | forbidden |
| STORE_STAFF | assigned by membership | forbidden | own metadata read | own | forbidden |

All role checks run in the staging backend, not in frontend hiding rules. No admin can retrieve full tokens via the API. Sensitive writes require a live session, CSRF, recent TOTP authorization and a reason; tenant service/channel/subscription changes also require an exact tenant-ID confirmation. Global role alone never grants store-owner cross-tenant access.

## Database domains (staging SQLite; D1 migration NOT performed)

`users`, `sessions`, `tenants`, `memberships`, `plans`, `subscriptions`, `payment_events`, `channels`, `knowledge`, `audit_events`, `login_attempts`. Foreign keys and uniqueness constraints guard tenant joins; `payment_events(provider,event_id)` enforces idempotency; channel accounts are unique across tenants. Audit rows are append-only with a SHA-256 chain (not an external WORM service).

## State dimensions must stay independent

- **Workflow state:** n8n Active/Inactive/Published/Draft (source = n8n API).
- **Tenant service state:** admin enabled/disabled (source = backend).
- **Store availability:** business schedule and pauses (not implemented).
- **Channel state:** VERIFIED/UNKNOWN/ERROR per provider verification (not implemented; staged metadata is UNKNOWN).
- **Subscription state:** lifecycle and entitlement (implemented in staging).

**Critical rule:** If multiple tenants use one n8n workflow, *never* unpublish the shared workflow because one tenant stops paying. At ingress, a real channel adapter must authenticate platform identity, map the external account to one tenant and ask the entitlement gateway; reject if not entitled.

## Required production integrations

- Existing Sites auth/D1 and deployment source must be inspected and backed up first.
- Migrate policies to the existing backend framework; use transactional D1 writes, bindings and KMS/secret store; no frontend token.
- Separate admin sessions from customer sessions, audit writes and business tenants. Rate limits must be shared across replicas, not limited to one SQLite file.
- Protect internal gateway HMAC secret, require valid provider webhooks *before* asserting channel account identity, reject replay with durable nonce storage, and use server-side quotas.
- Implement actual MFA enrollment/recovery, independent sessions revocation UX, device alerts, session anomaly detection, secret rotation and a disaster recovery test.

**Decision:** No Sites deployment, live account migration or production credential change was performed.