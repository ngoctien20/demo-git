# TIEN404 AI — V17.2C.40B Owner-Approved Source Authority Admission Packet

**CURRENT STATUS: AWAITING_OWNER_DECISION — NO APPROVAL GRANTED.** Draft-only. Read-only evidence collected; NO real owner/store authority has been provisioned. The JSON `qa/v172c-rpc-closure/v172c40b-owner-authority-registry-NOT_APPROVED.json` intentionally has zero actual mappings and six `false` release gates.

## 1. Owner business decision (must explicitly approve; not inferred)
In the same real Tenant there are two active Auth owners but only one QA Store. The owner must decide in a private authenticated approval flow:
- **Scenario S1**: Two people are co-owners of **one Store**. A/B *different Store* test is not applicable; authorization must be tested against an independently provisioned second Store or separate tenant without assuming same-tenant access.
- **Scenario S2**: They own **two distinct Stores under one Tenant**. Define two independently auditable canonical Stores, authorized owners/roles, separated product/Order/customer data and channel installations; prove each Store's owner has approved the boundary.
- **Scenario S3**: Relationship not yet settled. Keep every Store grant, channel binding, migration and real cross-channel Orders UAT BLOCKED.

**Neither S1 nor S2 is automatically chosen by this document.** Do not auto-promote QA `store_key` to a real UUID or copy its consent.

## 2. What counts as protected approval evidence
The signed/private evidence registry (to be created only after owner consent and separate security approval, outside GitHub) needs:
- `approval_version`, `approval_id`, immutable canonical `tenant_id`, authoritative `store_id`, approved owner `auth_user_id`, role/scope, timestamp/expiry, evidence issuer and verification method; include `revoked_at`, `reviewer_ref`, `change_ticket_ref`.
- A signed approval for **each Store boundary** and each Store owner grant; compare against current `auth.users`, `tenant_memberships`, server-side current session and revocation state. No client-supplied authorization claim; no stale JWT/user_metadata-derived ownership.
- For a channel installation: verified provider account/installation proof, official source + verification time, canonical Store scope, webhook route authority, consent, channel allowed operations, signing key rotation/replay design. Treat recipient identity as separate from owner identity.
- For n8n aliases: source registry and exact namespace (`TIEN404_COMMERCE_TENANTS`, `TIEN404_COMMERCE_CHANNELS`, R1 fixture or G05 fixture), declared one-to-one/many-to-one semantics, origin version, signed `alias→tenant_id→store_id` mapping, revocation, collision test and source policy.
- Signed independent security review of `public.qa_shop_b_zalo_claim`, `qa_owner_pairing` and `save_merchant_product` behavior. No direct grant changes by this task.
- Backup/restore evidence, financial admission/no extra fee, staging separation, migration rollback and approved Auth A/B negative-case plan.

**Store approvals are confidential artifacts.** Put only redacted evidence references/hashes in the protected server audit registry; do not store passwords, JWTs, provider tokens, personal identifiers, customer rows or unredacted receipts in GitHub/n8n logs or this conversation.

## 3. Exact admission contract (draft)
**Registry rule:** `DENY` unless all of these are verified at the time of the request:
1. Trusted source `provider_installation_ref` (or authenticated first-party Website session) is validated server-side, including signature/replay, route binding and current active status.
2. Trusted, revisioned crosswalk resolves exactly one `tenant_id + store_id` for this installation and operation (no user-supplied Store substitution).
3. Real currently valid owner Store membership, customer consent/identity if reading a private Order, and subscription/feature status are checked against server-side authority; revoke/expiry blocks access immediately.
4. Order/Product/Customer/Inventory resource carries canonical Store and Tenant lineage; cross-Store references are denied even within same Tenant. Unknown provenance is quarantined, not mapped.
5. Writer uses price VND, exact confirmation, scoped idempotency, stock/Order/outbox atomicity and protected server-side access, with independent Auth A/B/negative-case QA and approval.
6. No live send/write/merge until a separately approved release gate transitions to `APPROVED` and the reviewer has verified evidence, backup and cost.

**Important:** Passing QA fixture checks or string alias equality is only data consistency evidence. It is never an authority token. Even S2 approval alone does not authorize migration, production send or Order Writer promotion.

## 4. What is approved today?
- Permission to **audit** real Supabase metadata and n8n registry read-only, maintain a Draft PR, produce design/source-only safety tests: **IN-SCOPE**.
- Permission to create canonical Store tables, migrate Orders, backfill historical data, change RLS, issue Store permissions, use actual JWTs, publish n8n or send provider messages: **NOT GRANTED**.
- Owner signatures for S1/S2, per-Store grants, provider ownership, alias crosswalk, backup and production security review: **NOT SUBMITTED/NOT VERIFIED**.

## 5. Admission decisions for next owner turn
The next binding decision to resolve is **S1 vs S2** (one Store co-owned vs two distinct Stores). Once the actual owners have approved that in the protected flow, create separately signed evidence for Store A/B boundaries and map only those with source provenance. Until then, do not create “Store B” just to satisfy a test.

**Rollback:** this packet and immutable fail-closed JSON are Draft source files; revert their commits or close PR #392. No hosted runtime rollback is required because no privileged source registry was created.
