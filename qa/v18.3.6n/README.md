# TIEN404 AI — V18.3.6N

**Privileged Function Body Review Authorization × Real Auth Service Delete Semantics Contract × Production Crypto Trust Boundary Decision**

**Date:** 2026-11-19 JST  
**Parent:** V18.3.6M Draft PR #449, commit `c322721a4ce40cc864ae220419230c322b5d7231`, GitHub Actions [#44505388890](https://github.com/ngoctien20/demo-git/actions/runs/44505388890) SUCCESS (327/327 assertions, 4/4 transaction races).

**State:** `OFFLINE SECURITY DESIGN CANDIDATE / NO HUMAN APPROVAL / NO PRODUCTION ADMISSION`.

## Exactly what changed

- `function-review-authorization.mjs`: a strictly non-executing, synthetic policy gate for requesting **explicit owner approval** to inspect up to four exact function-body targets in staging, with reviewer separation, hashed scope, short validity and mandatory redaction. It **never authorizes** reads, grants, or sensitive sessions.
- `auth-service-delete-contract.mjs`: synthetic tests of documented Supabase signOut scopes `global/local/others`, role/session binding, JWT still valid post-signout, time-box/inactivity policy and 15 evidence gates for future real Auth UAT.
- `crypto-trust-boundary.mjs`: **design decision** for private Node-native Ed25519 verification + protected same-PG Auth/Store transaction, while **keeping the DB RPC signer/verifier mechanism undecided** until key custody and SQL privilege review.
- `test-n-security-contracts.mjs`: 64 offline negative/test-case assertions, including an all-true metadata fixture that can NEVER mark production permitted.
- `REVIEW_AUTHORIZATION_REQUEST.md`, `REAL_AUTH_DELETE_SEMANTICS_CONTRACT.md`, `CRYPTO_TRUST_BOUNDARY_DECISION.md`, `RISK_REGISTER_V18_3_6N.md` and checkpoint. No secrets or real session IDs.
- Dedicated GitHub Actions: G/H/I/K/L predecessor Node **245**, M crypto/privilege **29**, N security contract **64** = **338 offline assertions**. This stage does not re-run M PG17 SQL because those disposable lock races were already verified on M final HEAD and N does not alter their SQL.

## Things NOT done

- No access to `pg_get_functiondef`, `prosrc`, public SECDEF source code, real `auth.sessions`, Auth JWT/cookies, customer rows, production secrets or provider installations.
- No Supabase DDL/DML/GRANT/REVOKE, extension installation, KMS key creation, n8n workflow edit or real send.
- No independently verified real Auth signout API execution.
- No human reviewer or owner approval collected; approving this Draft PR is NOT permission to read function bodies or run real Auth API tests.
- No staging migration, order writer, provider send, provider token or release.

**Final decision:** V18.3.6N is **a proposed authorization and test contract**, not production security remediation. DRAFT / DO NOT MERGE/DEPLOY.
