# TIEN404 AI — V18.3.6O QA Checkpoint

**Checkpoint:** `V18.3.6O-SECDEF-GOTRUE-CRYPTO-44510204986`  
**Date:** 2026-11-19 JST  
**Status:** `LIVE STAGING METADATA VERIFIED / OFFLINE QA TESTED / REAL AUTH UAT & PRODUCTION BLOCKED`

## Parent and scope

- Parent V18.3.6N Draft PR #451, final HEAD `860d73ddc81c137b293a677f518784d96ec5f985`, GitHub Actions #44507690875 SUCCESS (338/338).
- Current V18.3.6O [Draft PR #454](https://github.com/ngoctien20/demo-git/pull/454), head branch `qa/v1836o-secdef-manifest-gotrue-crypto-20261119`, base N branch.
- Only `qa/v18.3.6o/` files and one dedicated GitHub Actions workflow modified. Unmerged, no deployment.

## Verified staging audit: actual PostgreSQL 17.11 metadata ONLY

- `public` contains **8** functions; exactly **4** `SECURITY DEFINER`, all owned by `postgres`.
- Exact callable identities (argument signatures) and SHA256 of their **identity only**, effective SQL role EXECUTE and configured search_path *presence only* are saved to `SECDEF_METADATA_MANIFEST.json`.
  - `qa_owner_pairing` — authenticated EXECUTE, SHA `b87688afabac23d1828a17051ae8596b5df15404bb4a8a6892ee7ff497bb32d1`.
  - `qa_shop_b_zalo_claim` — anon EXECUTE, SHA `c97e1a56edd33a5a3fcc250c4aa0c7b3d02c7820bce7d7a63f0ac1b23d92f6c4`.
  - `save_merchant_product` — authenticated EXECUTE, SHA `39f0171952722cb6df1cef490efb7da6eb3ee15a310638a355d6ebe2a81283a5`.
  - `tien404_tester_track_change` — service_role EXECUTE, SHA `2a0407fbba3194dff4e01673a3b38b4358700f328737da63d9dfe5eb269cfe31`.
- **The identity SHA is NOT a function body hash and does not prove code integrity or code safety.** No `pg_get_functiondef`, `prosrc`, function source text, executable invocation or sensitive constant accessed. Actual PostgREST exposure is **NOT** verified.
- Auth session relation `auth.sessions` exists with RLS enabled; effective direct `SELECT` for `anon`, `authenticated` and `service_role` is **false** for each. No session row/JWT/customer identity read. Do not grant these roles new access automatically.
- Canonical `public.stores` and `public.store_memberships`: 0; Store `store_id` across six Commerce tables: 0.
- Supabase Security Advisors previously verified SECDEF warnings; 4 public SECDEF / effective ACLs are a **REVIEW REQUIRED** finding, **not** a proven exploitable endpoint.

## Deliverables IMPLEMENTED

1. `SECDEF_METADATA_MANIFEST.json` and `SECDEF_METADATA_REVIEW_MANIFEST.md`: immutable staged identity-signature review scope, effective privileges, owner role and limits. Each function remains `BODY_REVIEW_STATUS=NOT_AUTHORIZED`. Explicit separate approval/independent reviewer required.
2. `READ_ONLY_SECDEF_METADATA.sql`: SELECT-only metadata snapshot. This SQL or equivalent was run on staging read-only, without source/body or data rows.
3. `secdef-manifest-review.mjs`: fail-closed drift detection of function count, scope, owner, role, SQL identity hash and false claims of having inspected function bodies.
4. `DISPOSABLE_GOTRUE_AUTH_UAT_PLAN.md` + `gotrue-disposable-plan.mjs`: 20 synthetic GoTrue/Auth scenarios and local-version/egress/credentials/teardown gates. **No disposable GoTrue project/runtime created**, no real signOut call.
5. `GATEWAY_CRYPTO_ADMISSIBILITY_MATRIX.md` + `rpc-proof-admissibility.mjs`: 3 CONDITIONAL RPC proof candidates, 4 REJECTED patterns, 12 mandatory security criteria. Even all synthetic evidence flags TRUE can only result in `EVIDENCE_PACKET_READY_FOR_PRIVATE_REVIEW`, never production approval.
6. `test-o-security-contracts.mjs`: 79 offline negative and review-contract tests. No network or production keys.
7. Dedicated GitHub Actions workflow `tien404-v1836o-secdef-gotrue-crypto.yml`, scoped read-only and offline.

## Initial CI evidence before checkpoint commit

[GitHub Actions #44510204986](https://github.com/ngoctien20/demo-git/actions/runs/44510204986), `review-matrix-offline` job ID `135512148402` **SUCCESS**:
- V18.3.6G–L predecessor: **245/245 PASS**.
- V18.3.6M–N predecessor: **93/93 PASS**.
- V18.3.6O metadata, GoTrue plan and crypto matrix: **79/79 PASS**.
- Total **417/417 numbered Node tests PASS**.
- Source scan `V18_3_6O_READ_ONLY_SCOPE_QA_PASS` prevents function body reads, real session row access, schema SQL writes and secret/network runtime operations.
- CI found no assertion failure or scan failure.

**FINAL-HEAD RULE:** this checkpoint is added after run #44510204986. A new GitHub Actions run associated with the checkpoint commit must pass before claiming final-HEAD acceptance.

## Protected runtime baseline — read-only recheck

Published n8n versions unchanged:
- Messenger `Z7FdV7uDvApfbURQ`: `1064b1b3-d3f1-4a6b-a367-2414ba691522`.
- Zalo Bot `yIJk8LvJoLF40Z62`: `2d912cb0-007f-452f-9536-b92ba12a03e6`.
- Commerce Core `iyfGUiEsZlNTBWOR`: Published `456862c9-e5ee-4bfa-9931-47dbc39ab73d`, separate draft `c96422e0-170b-46a3-8d75-3a2695e645e7`.

No staging DDL/DML/GRANT/REVOKE, no real `auth.sessions` row/credential/key, no Auth API login/logout, no user/customer/Orders read, no n8n execution/modification or provider send.

## Explicit blockers and next decision

| Gate | State |
|---|---|
| Four function metadata identities/ACLs | VERIFIED READ-ONLY |
| Function BODY security review | BLOCKED — separate owner approval + independent reviewer |
| Private Data API/SQL effective caller and source review | BLOCKED |
| Disposable GoTrue UAT 20 real scenarios | PLAN ONLY — separate resource/operator approval |
| Actual Auth session DELETE/expiry in GoTrue service | BLOCKED |
| Postgres private Auth session reading/access grants | BLOCKED — no direct SELECT for anon/authenticated/service_role |
| 12 mandatory RPC proof criteria | DEFINED, NONE PROVEN IN PRODUCTION |
| Production RPC verifier/signing keys | UNSELECTED / BLOCKED |
| Canonical Store A/B real Authority | BLOCKED |
| Billing, Commerce write, notifications, provider send | NO-GO |
| Independent security release / production deployment | NO-GO |

**Risk:** Production access would be unsafe if metadata review were mistaken for function-source validation, synthetic GoTrue plans for actual signOut proof, or all-green crypto metadata for a real trusted key.

**Rollback:** Close unmerged Draft PR #454. No linked environment state changed, no staging rollback required.

**Next safe checkpoint proposed:** `V18.3.6P — Owner-Approved Private SECDEF Review Gate × Isolated GoTrue Local Test Harness Design × Auth/Store Transaction Attestation QA`. Separate explicit approvals remain mandatory before any function body read, local container/credential creation, real Auth testing, or privileged SQL change.
