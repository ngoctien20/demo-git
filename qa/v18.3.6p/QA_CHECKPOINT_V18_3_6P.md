# TIEN404 AI — V18.3.6P QA Checkpoint

**Checkpoint:** V18.3.6P-PRIVATE-REVIEW-GOTRUE-TX-44512674653  
**Date:** 2026-11-19 JST  
**Status:** OFFLINE SIGNATURE/SECURITY QA TESTED; DISPOSABLE PG17 TESTED; REAL OWNER/SECDEF BODY/GoTrue AUTH BLOCKED; PRODUCTION NO-GO.

## Baseline

- Parent V18.3.6O Draft PR #454, final HEAD d3c8e12831a842d6dfb24e165357ba279087d2b0, GitHub Actions #44510479318 SUCCESS (417/417 offline).
- Current V18.3.6P Draft PR [#457](https://github.com/ngoctien20/demo-git/pull/457), base qa/v1836o-secdef-manifest-gotrue-crypto-20261119, head qa/v1836p-owner-review-gotrue-attestation-20261119. DRAFT, NOT MERGED.
- No real Supabase DDL/DML, grant change, JWT/owner session read, function source/body read, KMS/credentials provisioning, GoTrue runtime start, production send or Commerce order write.

## Implementation details

1. private-secdef-review-gate.mjs: Ed25519 synthetic dual-signature envelope, same exact four O SECDEF metadata identities, 3 distinct actor labels, staging-only, short <=3600s window, private evidence placeholder, read-only and hard no Auth session/secrets/grant scope. A synthetic signature **never** proves real owner/reviewer identity. No execution permission is ever returned.
2. isolated-gotrue-harness-plan.mjs: design-only local stack blueprint with pinned CLI semantic version and image digest requirements, loopback, container-internal PG↔Auth, no external egress/email/SMS/webhook, strict no-real-owner, no staging volumes, temporary local credentials and teardown. Even with all booleans true it reports containersStarted=0, actualAuthCalls=0, authorizedToStart=false. No GoTrue service or local Auth users created.
3. auth-store-tx-attestation.mjs: Ed25519 integrity validation of a **synthetic** ordered transaction transcript (session check→session row lock→Store membership lock→resource lock→nonce consume→commit). Rejects false store/session, missing steps, tampered signer, wrong transaction IDs, bad timestamp, rollback, unauthorized read, replay or revoked Auth. Reports actualPostgresTransactionVerified=false and actualGoTrueSessionVerified=false; never claims real DB commit.
4. test-p-security.mjs: 98 offline negative/canonicalization tests.
5. 03_DISPOSABLE_PG17_TX_ATTESTATION.sql: 17 additional actual PostgreSQL 17.12 pgTAP assertions after replaying M fixture + 53 existing assertions. Confirms session A was deleted, Store B still available, B→A resource access denied, a new JTI consumed once, replay denied and denial did not burn nonce, read gateway no direct access to Auth or membership tables.
6. Dedicated GitHub Actions workflow tien404-v1836p-private-review-tx-attestation.yml.
7. Private review gate ADR, isolated GoTrue harness design, Auth/Store attestation limitations and README.

## Initial CI evidence before checkpoint commit

[GitHub Actions #44512674653](https://github.com/ngoctien20/demo-git/actions/runs/44512674653), both jobs SUCCESS, verified from logs:
- V18_3_6P_PREDECESSOR_417_PASS: previous G–O **417/417** Node.
- V18_3_6P_SECURITY_CONTRACT_98_PASS: new P **98/98** Node.
- V18_3_6P_OFFLINE_SCOPE_SCAN_PASS: static audit rejects live API/function source/production credentials, SQL DDL changes.
- V18_3_6P_M_PG17_53_PASS: actual disposable PG17 **53/53** pgTAP.
- V18_3_6P_PG17_TX_ATTESTATION_17_PASS: actual disposable PG17 **17/17** pgTAP.
- **515/515 Node + 70/70 PostgreSQL = 585/585 numbered assertions PASS**. No failed Node assertion, SQL error, failed pgTAP or unremoved DB container in successful log.
- Disposable PostgreSQL 17.12 was started with Docker '--network none', no exposed ports, and removed on completion.
- M's separate 4 real PG17 concurrency scenarios remain verified in M final CI #44505388890; not re-run as part of P.

### Transparent recovery note
Earlier P CI #44512106020: both suites 417/417 and 98/98 passed; PostgreSQL 70/70 succeeded, but a **static scanner false positive** treated a substring of synthetic table qa_m_auth.sessions and an SQL comment as a real auth.sessions access. The scanner now strips SQL comments and uses a word-boundary guard; it does not relax privilege, Auth or time limits. CI #44512674653 passes all checks.

**Final-HEAD condition:** This checkpoint is committed AFTER CI #44512674653. A new workflow run must be verified on the checkpoint's final SHA before marking full final-head acceptance.

## Verified live staging baseline (read-only, 2026-11-19 JST)

Supabase staging ifxlvrhyjhbzbrkdsida, PG17.11:
- 8 functions in public, 4 SECURITY DEFINER; effective EXECUTE: anon 1, authenticated 2, service_role 1, counts can overlap.
- Effective direct SELECT of auth.sessions for anon, authenticated and service_role: all false. No session rows accessed.
- Public stores/store_memberships: 0, store_id on six Commerce tables: 0.
- No privilege/credential/schema changes or function-body access.

n8n published workflow metadata unchanged:
- Messenger Z7FdV7uDvApfbURQ Published 1064b1b3-d3f1-4a6b-a367-2414ba691522.
- Zalo Bot yIJk8LvJoLF40Z62 Published 2d912cb0-007f-452f-9536-b92ba12a03e6.
- Commerce Core iyfGUiEsZlNTBWOR Published 456862c9-e5ee-4bfa-9931-47dbc39ab73d; separate draft c96422e0-170b-46a3-8d75-3a2695e645e7.
- No provider send, workflow execution or modification.

## Admission / QA status

| Gate | Status |
|---|---|
| Ed25519 synthetic dual-control receipt | IMPLEMENTED / TESTED / NOT REAL OWNER APPROVAL |
| Real owner-approved private SECDEF body review | BLOCKED / NO ACCESS |
| Isolated GoTrue local harness | DESIGNED / NO CONTAINERS / SEPARATE APPROVAL REQUIRED |
| Real Auth signOut and session deletion | BLOCKED |
| Synthetic signed transaction transcript bytes | TESTED / NOT REAL PG PROOF |
| Disposable PG17 M+P session/Store/nonce checks | TESTED 70/70 |
| Same-Tenant real Store A/B RLS and actual Auth identity | BLOCKED |
| Private SQL caller cryptographic proof and production KMS custody | BLOCKED |
| Independent human security reviewer | BLOCKED |
| Production order writer, provider send, staging migration | NO-GO |

**Primary P0:** A short-lived token signature or self-signed synthetic reviewer packet cannot establish real revoked-session authority or cross-Store isolation. Production SQL EXECUTE permission/SECDEF may bypass RLS; exact function bodies/privileged caller still require a separate authorized independent review.

## Risk, rollback and next step

Changes are limited to new QA files and dedicated CI. No linked environment was mutated. Rollback by closing unmerged Draft PR #457; disposable PG17 container already removed.

**Recommended V18.3.6Q (separate approval gates):** Private owner/reviewer authorization intake × disposable GoTrue Auth/Store runbook and version preflight × real session-lock/RPC signer trust boundary decision. Only implement bounded QA and documentation without new privileges or resources unless explicit authorization is given.
