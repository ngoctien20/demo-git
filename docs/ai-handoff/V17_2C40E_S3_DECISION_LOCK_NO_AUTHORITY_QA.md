# TIEN404 AI — V17.2C.40E S3 Decision Lock × Zero-Mapping Crosswalk × Private Transition Guard

**Date:** 2026-11-18 JST  
**Parent:** V17.2C.40D  
**Draft PR:** #392  
**Tested implementation commit:** abb207ec0c07f67f262fac877ba50bb4a6e44181  
**Status:** IMPLEMENTED / 22-TEST S3 QA PASS / HOSTED AUTHORITY NO-GO.

## 1. Explicit project decision

The project operator explicitly selected **S3 — owner relationship not yet established** in this conversation. This is recorded as a project-level decision only. It is not proof that the selecting person is a legal or authenticated owner of any real Tenant or Store, and it is not signed owner consent.

The new S3 record is:
- decision_ref: `synthetic-decision-s3-v1`
- decision_version: 1
- lock_state: `LOCKED`
- store_refs: empty
- owner_consents: empty
- alias_mappings: empty
- owner_authority_verified: false
- identity_verified: false
- authority_effect: `NONE`

The earlier V40D general NOT_APPROVED template remains a historical schema example. The V40E S3 record is the specific project decision selection for this checkpoint.

## 2. S3 no-authority lock policy

The S3 lock contract checks the decision record and its crosswalk together. A valid S3 lock returns `S3_LOCKED_DENY`; this means the safe deny state is correctly represented, not that access was granted.

The policy requires:
- No Store refs, owner consents, alias mappings or provider installation mappings.
- Every decision and crosswalk release gate remains exactly false.
- No owner authority or real identity is claimed.
- Crosswalk references the same S3 decision ref and contains zero mappings.
- No credential, token, JWT, email, phone or customer information in public artifacts.
- The selection is `POLICY_SELECTION_ONLY`, sourced from explicit project-operator selection, not from a verified private owner workflow.

The Git record is reviewable and traceable, but the JSON file itself is not cryptographically immutable. "Locked" describes the fail-closed project policy; it does not claim tamper-proof storage.

## 3. Future transition from S3

S3 cannot be changed in place. Any later S1/S2 proposal must create a new decision version and preserve the existing S3 record in history.

A future transition proposal must be backed by a separately implemented private authority service that verifies:
1. Current authenticated owner sessions server-side.
2. Fresh, single-use challenges/nonces bound to the intended decision and Store scope.
3. Separate signed owner consent for every Store boundary.
4. Current Tenant and Store membership, plus revocation/expiry state.
5. Independent security reviewer and trusted signature verification.
6. A new immutable decision version and explicit release review.

The V40E source validator only checks the synthetic shape of this transition evidence. Even when all synthetic fields are present, its maximum result is `PRIVATE_AUTHORITY_REVIEW_REQUIRED`. It never admits real Auth A/B, Store membership, migration, Order read/write, provider dispatch or production release.

## 4. IMPLEMENTED artifacts

- `qa/v172c-rpc-closure/v172c40e-s3-owner-decision-LOCKED-NO-AUTHORITY.json`: selected S3 project decision, version 1, no owner or Store evidence.
- `qa/v172c-rpc-closure/v172c40e-s3-crosswalk-LOCKED-NO-MAPPINGS.json`: S3 crosswalk with empty mapping list and all gates false.
- `qa/v172c-rpc-closure/v172c40e_s3_lock_contract.py`: pure source validator for S3 lock and future private-transition preflight.
- `qa/v172c-rpc-closure/v172c40e_s3_lock_contract_test.py`: regression suite for lock mutation, Store/consent/mapping injection, gate changes, in-place transition, missing private evidence, expiry and no-authority guarantees.
- `.github/workflows/v172c15-ephemeral-postgres-qa.yml`: new V40E synthetic-only test step. It runs in disposable CI; no hosted Supabase or provider access.

## 5. Current independent Supabase read-only recheck

The current staging aggregate SELECT confirms:
- 1 Tenant with at least two active owner candidates and only 1 QA Store.
- `public.stores` absent.
- `public.store_memberships` absent.
- 0 `store_id` columns across Orders, OrderItems, Products and Customers.
- 0 private channel-secret rows.
- 0 protected channel-identity, customer-binding and order-ownership rows.

No Supabase schema, data, policy, grant, credential or branch was changed by V40E. These aggregate facts do not resolve S1/S2 and support retaining S3.

## 6. QA evidence

- First attempt at commit `fc2c2dd41ff5f72084c2b92b99f295de73599576`: **FAILED 9/22** because the validator compared JSON string scalars with Python object identity (`is not`). No Supabase/hosted write was involved.
- Corrective commit `abb207ec0c07f67f262fac877ba50bb4a6e44181` changed the comparison to strict type + value equality.
- Re-run [PostgreSQL 17 workflow #44262649461](https://github.com/ngoctien20/demo-git/actions/runs/44262649461): **22/22 tests PASS** (`Ran 22 tests ... OK`); all earlier disposable PostgreSQL transaction/RLS drills in the same job also completed successfully.
- All 3 PR check runs at the tested code commit are **SUCCESS**: [synthetic private-auth contract](https://github.com/ngoctien20/demo-git/actions/runs/44262649466/job/134659470811), [no-send source contract](https://github.com/ngoctien20/demo-git/actions/runs/44262649454/job/134659470614), [disposable PostgreSQL + V40E](https://github.com/ngoctien20/demo-git/actions/runs/44262649461/job/134659470507).
- Expected test command:
  `python3 -m unittest discover -s qa/v172c-rpc-closure -p 'v172c40e_s3_lock_contract_test.py' -v`
- V40D's separate 41/41 PASS at commit `8b144682771032eef37c593aac34c41638300ec9` remains separate evidence.

## 7. Status, risk and rollback

- **VERIFIED:** User explicitly selected S3 in this conversation; current Supabase aggregate state still has no canonical Store schema or Store-scoped Commerce rows.
- **IMPLEMENTED:** S3 lock record, zero-mapping crosswalk, no-authority validator and synthetic transition guard.
- **TESTED:** V40E 22/22 PASS on the corrected code commit; all 3 PR checks SUCCESS. Initial failure was corrected and rerun.
- **PROPOSED:** Private owner authority service, not implemented.
- **BLOCKED:** Real owner identity, signed per-Store consent, Store membership, alias crosswalk, Auth A/B and canonical Store RLS.
- **NO-GO:** Hosted migration, Store grants, Orders read/write, n8n Published changes, provider dispatch and production release.
- **Rollback:** Revert V40E source/test/JSON/workflow/doc commits from Draft PR #392. No hosted rollback is required because no hosted system was changed.

## 8. Next checkpoint

Continue with **V17.2C.40F — Private Owner Authority Service Threat Model × S3 Transition API Contract × Replay/Revocation Test Design**. Keep the implementation source-only until an approved private service and real owner evidence flow are separately authorized. Do not create Store tables or change RLS as part of 40F.
