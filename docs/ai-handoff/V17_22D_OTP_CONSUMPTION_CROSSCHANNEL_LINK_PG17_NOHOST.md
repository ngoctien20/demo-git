# TIEN404 V17.22D — Private OTP challenge consumption vs cross-channel account linkage (PG17)

**17 November 2026 JST — DRAFT / DISPOSABLE PG17 / SOURCE ONLY / NO PROVIDER SEND**

## Scope and exact parent
- Parent [V17.22C PR #351](https://github.com/ngoctien20/demo-git/pull/351), pinned SHA `01d310ed757aa95f7546c146f8d1829a095b63c4`. Parent and native bot workflows are not modified.
- Parallel V17.23I/J [PR #352](https://github.com/ngoctien20/demo-git/pull/352) / [PR #354](https://github.com/ngoctien20/demo-git/pull/354) already cover owner source-provenance, Store schema dependencies and real-JWT private admission; do not duplicate these evidence intake or JWT workflows.
- Intended final owner UAT remains opt-in synthetic Messenger QA order -> two-code link -> same person's Zalo Bot status, with different Messenger/Zalo actors or Store B denied.

## Critical gap in existing unapplied candidate

V17.22C correctly introduced composite scope foreign keys on `Tenant / Store / Messenger actor / Zalo actor`, but a future writer could insert an active `channel_links` row that referenced a perfectly matching **pending (unconsumed) OTP challenge**. An actor owning an arbitrary Zalo ID or knowing an order reference is not authorized by this FK alone. This is a source/schema defect, not evidence of an attack against live Supabase (the schema has **never been deployed**).

## Narrow DB integrity hardening (unapplied schema)

- On `link_challenges`, `is_consumed` is a PostgreSQL 17 **stored GENERATED ALWAYS** boolean derived from `consumed_at IS NOT NULL`, not an input field controlled by the caller.
- A challenge may be consumed only when both Zalo actor and Zalo OTP hash are present, and `consumed_at` falls inside the challenge lifetime.
- `channel_links.require_consumed` is **NOT NULL, DEFAULT TRUE, CHECK TRUE**. Its composite FK now also requires the referenced challenge's generated `is_consumed` to be TRUE. Any attempt to create a link for a pending challenge fails even when Tenant, Store and actor hashes match.
- Reopening an already linked challenge by setting `consumed_at=NULL` violates the referenced composite FK.
- Strictly preserves private schema, four forced-RLS tables, zero policies, zero public/anon/authenticated/service-role grants, no external functions or `SECURITY DEFINER`.

## Executable QA (disposable only)
- Original V17.22C [PG17 negative tests](../../qa/v1722-cross-channel-order/pg17-disposable-scope-fk-security.sql) are inherited untouched.
- New [SQL test](../../qa/v1722-cross-channel-order/pg17-disposable-otp-consumed-gate.sql) first tries linking a **pending** challenge, then tries falsifying the child `require_consumed` flag. Both must be denied. A synthetic private-writer-like `UPDATE ... WHERE consumed_at IS NULL AND expires_at > clock_timestamp()` then accepts one state change, with an immediate second attempt returning **zero** rows, after which the link succeeds. Test also denies re-opening a linked challenge and an expired, still-pending challenge. All fake rows are cleaned in the ephemeral DB.
- New source Node test ensures the necessary generated-field/composite-FK contract cannot disappear silently. The GitHub Actions PG17 job runs existing cases and the new SQL against a fresh `postgres:17` service with non-production fake identities.
- **Precision:** the single-use update is a *sequential conditional-claim test*, **not independent true parallel concurrent worker testing**. It does not implement a real OTP issuer, OTP challenge validation, event replay across workers, or customer consent.

## Remaining hard NO-GO gates
Actual Meta signed Page binding; native Zalo Bot vs OA authority; same-Store ownership proof; independent Auth/JWT admission; current M0 restore scope and independent backup acceptance; real least-privilege SQL transaction writer; replay durability and cross-process atomicity; genuine UAT with two consenting accounts; no-send and rollback independent evidence. User deferred local Windows Preflight, **not** waived these hosted deployment gates.

**No** Supabase hosted SQL, n8n workflow updates, provider send, AI model cost, Meta token, Zalo OAuth, migration or live order. **Rollback:** close this draft PR; no hosted state changes.

**Release state:** `SOURCE_IMPLEMENTED / PG17_CI_PENDING / HOSTED_NO_GO` until exact-head CI is independently checked.
