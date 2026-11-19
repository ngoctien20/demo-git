# TIEN404 V18.3.6Q — Private Security Review Approval Intake

**Status:** APPROVAL REQUEST WORKFLOW IMPLEMENTED / ACTUAL OWNER CONSENT NOT RECEIVED. Date 2026-11-19 JST.

## Verified entry baseline

Parent V18.3.6P Draft PR #457, final HEAD f8404ca771244592db4fcb795b27c4deae5d496e, GitHub Actions #44512981812 SUCCESS (515/515 Node + 70/70 disposable PostgreSQL 17). Staging project ifxlvrhyjhbzbrkdsida PG17.11: 8 functions in public, 4 SECURITY DEFINER; effective EXECUTE anon=1, authenticated=2, service_role=1. No canonical public stores/store_memberships, no Store-scoped Commerce columns. Neither 'authenticated' nor 'service_role' has SQL SELECT privilege on auth.sessions according to live metadata. This is NOT a proof of non-exposure through a separate privileged function.

## Intake requirements

`private-approval-intake.mjs` accepts only metadata, with no runtime side effects. It enforces exact staging project and read-only purpose, four function identities from O's manifest, 40-character Git SHA of reviewed implementation, 64-hex SHA256 of scope/evidence, independent owner/reviewer/implementer labels, a <=1-hour review window, and no real Auth session/secret or permission updates.

1. A human project owner MUST explicitly approve the exact target function signatures, purpose, scope, operator, reviewer, private storage and expiry in a verifiable out-of-band process.
2. A distinct qualified human reviewer MUST confirm the owner's identity, actual approval and source evidence. Hashes, labels, self-signed artifacts or CI pass DO NOT establish that identity.
3. Function bodies can only be inspected after a separate explicit authorization and within a confidential private review workspace. Never publish source, embedded credentials, parameters, actual data or tokens into GitHub/ChatGPT logs.
4. No inspection approval automatically authorizes invoking the privileged function, GRANT/REVOKE, DDL, updating Auth config, creating GoTrue users, creating credentials or production deployment.
5. Each authorized review records bounded evidence IDs, implementation commit SHA, sanitized findings, rollback plan and independent signoff. No unapproved permission changes.

A complete input returns `COMPLETE_REQUEST_AWAITING_EXTERNAL_OWNER_HUMAN_VERIFICATION`. This is deliberately NOT `AUTHORIZED`: `ownerConsentVerified=false`, `functionBodyAccessAuthorized=false`, `productionChangesAuthorized=false`. Missing/bad fields return `BLOCKED_INTAKE`.

## Four function review targets (identity only)

- qa_owner_pairing(p_shop uuid, p_action text, p_challenge uuid) — effective authenticated EXECUTE
- qa_shop_b_zalo_claim(p_challenge uuid, p_code text, p_sender text, p_event text) — effective anon EXECUTE
- save_merchant_product(p_tenant uuid, p_sku text, p_name text, p_price bigint, p_active boolean, p_initial_stock integer, p_expected_updated_at timestamptz) — effective authenticated EXECUTE
- tien404_tester_track_change() — effective service_role EXECUTE

All four owner postgres; O's SHA-256 is **of each function's SQL identity only, NOT its body**. Actual search_path configuration value, source, RLS bypass and Data API route exposure need a private authorized review.

## Requested decision (NOT preauthorized by choosing phase Q)

A project owner may later authorize ONLY a bounded private staging review of the exact four functions and separately assign an independent reviewer. A distinct consent is required for GoTrue runtime resource creation and any future privileged SQL adaptation, real Auth account or production release.

**Current:** NO_FUNCTION_BODY_READ / NO_REAL_AUTH_SESSION_ACCESS / NO_GRANT_CHANGE / NO_DEPLOY.
