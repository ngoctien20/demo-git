# V18.3.6P — Owner-Approved Private SECDEF Review Gate

**Date:** 2026-11-19 JST. **Security classification:** PROPOSED APPROVAL GATE / NO REAL OWNER AUTHORIZATION.

## Verified baseline from O

Four public SECURITY DEFINER functions in staging project ifxlvrhyjhbzbrkdsida were listed in O's metadata manifest:
- qa_shop_b_zalo_claim: effective EXECUTE by anon
- qa_owner_pairing: effective EXECUTE by authenticated
- save_merchant_product: effective EXECUTE by authenticated
- tien404_tester_track_change: effective EXECUTE by service_role

All four are owned by postgres and have some search_path configuration, **values and bodies unreviewed**. The O SHA256 is the hash of schema+function signature only, **not a body hash**. PostgREST route exposure and exploitability are not proved.

## Two different authorization layers

1. The synthetic technical gate (IMPLEMENTED): private-secdef-review-gate.mjs verifies two Ed25519 signatures using ephemeral QA test keys, over a strictly serialized and scoped review request. It requires exact manifest hashes, project staging, read-only review purpose, three distinct actor labels (owner, reviewer, implementer), a <=1 hour review window, private evidence destination and explicit prohibition on reading Auth sessions/credentials or modifying permissions.
2. Real owner approval (NOT RECEIVED): the actual project owner must explicitly authorize the exact function source targets, environment, time window, independent reviewer, private evidence retention and audit log. Real owner identity/key custody must be verified through a separate trusted process, NOT fixture key pairs or metadata checkboxes. A Draft PR or the phase title is not such permission.

A synthetically valid signed request returns SYNTHETIC_SIGNATURES_PASS_PRIVATE_HUMAN_APPROVAL_STILL_REQUIRED. It **always** returns functionBodyReadAuthorized=false, permissionWritesAllowed=false and productionAdmitted=false.

## Separate permissions still required

- Private inspection of the exact function bodies in a confidential reviewer workspace, with no source or embedded secrets in GitHub/ChatGPT logs.
- Independently reviewed ability to run any privileged function, even against QA data.
- Real Auth login/signout or session-row query, isolated UAT resources and test-identity creation.
- GRANT, REVOKE, function replacement, RLS migration, key changes and production deployment.

These are distinct approvals and cannot be bundled into a single open-ended authorization. After consent, the reviewer would compare body hashes in the private workspace, inspect owner/RLS bypass, search_path value, dynamic SQL, trusted tenant/store authority and API exposure; publish only redacted findings and a separate remediation PR with rollback.

**Current result:** OWNER_REVIEW_REQUEST_PREPARED / FUNCTION_BODY_ACCESS=BLOCKED / PERMISSION_WRITES=NO-GO.
