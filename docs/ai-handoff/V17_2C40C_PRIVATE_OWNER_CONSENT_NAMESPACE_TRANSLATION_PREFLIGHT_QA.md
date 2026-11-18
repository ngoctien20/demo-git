# TIEN404 AI — V17.2C.40C Private Owner Consent Evidence × Namespace Translation Admission Preflight

**Date:** 2026-11-18 JST. **Parent:** V17.2C.40B CHECKPOINT HEAD `042abf3f0c43ff4e1006767d76f96dc0db6cb849`, Draft PR #392. **Tested code commit:** `1a1a18ccd48e683d72aea0d579ce519a31b099e8`. **State:** SOURCE-ONLY SAFETY PREFLIGHT TESTED PASS / REAL AUTHORITY NO-GO.

## 1. Live evidence revisited (READ-ONLY)
Connected directly to Supabase staging `ifxlvrhyjhbzbrkdsida`; SELECT only aggregates, no Auth tokens, names/emails, customer or Order contents, credential references or provider receipts.
- One real Tenant has two distinct active owner candidates, but **one** QA Store associated with that Tenant. There is no approved decision of S1 (co-owners of one Store) versus S2 (two independent Stores under one Tenant).
- Two R1 QA owner bindings are paired and unexpired; **one** has a complete confirmed pairing claim + consumed challenge + active real tenant owner requester chain, **one** remains without evidence of this exact chain. This is missing provenance, not evidence of impersonation.
- Supabase protected QA `channel_identity`, `auth_customer_binding`, `order_ownership` are empty; `app_private.channel_secrets` has no channel installation rows; `public.stores` and `public.store_memberships` are absent. Commerce Orders/Items/Products/Customers still have no canonical Store scope.
- Read-only n8n Commerce Tenants has four Tenant aliases and Commerce Channels six records in that internal namespace. V40B confirmed 6/6 channels internally resolve, but none of four n8n Tenant aliases is directly equal to a Supabase real Tenant UUID; source-alias translation remains unverified. No source ID was guessed or remapped.
- Supabase branching check: `[]` (zero dev branches) at start; no branch/migration was created. n8n published workflows unchanged.

## 2. Implemented source-only preflight
- `qa/v172c-rpc-closure/v172c40c_private_owner_alias_admission.py`: deterministic no-I/O inspector that accepts **only synthetic** Tenant, Store, owner approval and alias proposals, and **never** grants real authority.
- Distinguishes S1 (two co-owners of one Store; not sufficient for Store A/B test) from S2 (exactly two distinct synthetic Stores and two independently identified synthetic Store owners). Undecided defaults BLOCKED.
- A synthetic owner claim must include independent reviewer, explicit consent, confirmed and consumed challenge, current-session attestation, exact Store+Tenant scope, explicit not-revoked/not-expired booleans, and synthetic source. Missing fields, mismatched tenant or stale/revoked consent deny.
- Namespace-qualified alias mapping requires a declared allowed synthetic source, namespaced alias, independent source/binding/provider/reviewer attestation flags, exact Tenant+Store, explicit not-revoked/not-expired status; duplicates and collisions across two Stores are denied. Reusing an alias **across distinct declared namespaces** remains distinguishable, not silently coalesced. One installation claimed by two Stores is blocked.
- Nested sensitive-field names such as `jwt`, `credentialRef`, `accessToken`, `private-key`, `auth_user_id`, phone and email trigger a fail-closed result. Malformed alias data (including unhashable object source) cannot produce an authority grant.
- **Best possible result:** `SYNTHETIC_REVIEW_ELIGIBLE_ONLY`, always `authority_granted=false`, `real_ab_uat_admitted=false`, `migration_admitted=false`, `production_send_admitted=false`. It cannot perform cryptographic verification or authorize anything. The boolean attestation fields are synthetic test signals, **not** proof of a real signature.
- `qa/v172c-rpc-closure/v172c40c_private_owner_alias_admission_test.py`: 40 synthetic acceptance/negative tests. Existing CI workflow `.github/workflows/v172c15-ephemeral-postgres-qa.yml` runs the test as an additional step, after V40B default-DENY registry validation. No external API, provider, database or user session used for the new step.
- Existing immutable `qa/v172c-rpc-closure/v172c40b-owner-authority-registry-NOT_APPROVED.json` remains NOT_APPROVED and has empty mapping/Store owner lists; the new test expressly checks this source of truth does not claim approval.

## 3. TESTED — exact GitHub Actions evidence
At **code commit `1a1a18ccd48e683d72aea0d579ce519a31b099e8`**:
- [PG17 regression + V40B default-DENY + V40C consent/alias preflight run #44258562308](https://github.com/ngoctien20/demo-git/actions/runs/44258562308) **SUCCESS**. Job logs show `Ran 40 tests ... OK` and the V40C step PASS.
- [RPC privileges source-only #44258562258](https://github.com/ngoctien20/demo-git/actions/runs/44258562258) **SUCCESS**.
- [Protected Consent source-only #44258562198](https://github.com/ngoctien20/demo-git/actions/runs/44258562198) **SUCCESS**.
- This evidence is *source policy and synthetic fixtures only*. It is not live provider signing, real JWT A/B or migration rehearsal on actual data.

## 4. Private owner approval contract (PROPOSED, no implementation)
To move beyond this preflight safely, a future **private server-side** authority registry must independently verify:
1. S1/S2 owner decision and actual Store boundary by separately authenticated owners; if S1, do not claim two-Store isolation.
2. Signed/verified owner session, challenge consumption, immutable consent scope, exact canonical tenant and Store, effective/expiry/revoked dates, independent human reviewer, and evidence issuer; proof must be stored privately, not in GitHub.
3. Independent alias resolution, preserving `source_system + namespace + exact alias + version` and cryptographically verified provider installation authority. Unknown or colliding aliases remain quarantined; never match by phone, sender text, model guess or QA-approved flag.
4. Store-specific RLS, owner membership and Order provenance with a safe Store-scope cutover and independently tested recovery.
5. Read-only authenticated A/B probes only after the above, using two distinct real sessions under explicit consent and non-customer test data. Never copy JWT into this chat/issue/CI.
6. Separate approval for actual schema migration, permissions, credential operations, n8n production release or messages and any budget changes.

## 5. Compatibility risks and gates
- Tenant-wide permissive SELECT RLS, no `store_id`, tenant-only Order idempotency and legacy Messenger Google Sheets order tools remain open P1 release blockers (#399/#402/#403). A source-only preflight cannot close them.
- `qa_shop_b_zalo_claim`, `qa_owner_pairing` and `save_merchant_product` privileged functions require independent reviewer before any Auth/write cutover.
- No external exactly-once delivery or actual provider evidence tested. V17.2C.35–39 remain synthetic no-send candidates and do not authorize live Commerce.
- **No Supabase DDL/DML, migration, new branch, real JWT retrieval, real Auth UAT, n8n publish/execution, provider send, customer/order writes or credential changes performed.**

## 6. Checkpoint / rollback / next
- **VERIFIED:** live read-only source aggregates, source repository checkpoint, exact V40C CI 40/40 tests.
- **IMPLEMENTED:** GitHub Draft-only synthetic preflight, 40-case test suite and CI workflow step.
- **TESTED:** policy negatives and immutable default-DENY source contract PASS.
- **PROPOSED:** future protected private owner approval/session evidence and trusted alias crosswalk; not actually created.
- **BLOCKED:** S1/S2 actual owner approval, complete Store ownership provenance, Store schema/RLS, signed provider installation and Auth A/B real test.
- **RELEASE:** NO-GO multi-Store private Orders and writer.
- **Rollback:** revert V40C Python/test/CI/docs commits on Draft PR #392; no hosted rollback since no writes.
- **Next priority:** private owner decision S1/S2 and independent evidence review to resolve #399/#402; after approval, review the unmatched owner-binding's historical path and implement no-write protected alias translation UAT in isolated authorized infrastructure. Do not manufacture Store B to satisfy tests.
