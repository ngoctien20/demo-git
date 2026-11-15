# V14.4.8 — Private recovery and Store ownership runbook

STATUS: DRAFT ONLY. No database changes authorized.

## Recovery facts
- Operator verified schema-only recovery of the existing five-schema archive on local Supabase PostgreSQL 17.11: 38 tables and RLS restored.
- Full data restoration failed because the archive omitted Auth records needed by application foreign keys. The single transaction rolled back.
- The staging metadata audit found 3 Auth users and 9 foreign keys from 7 application tables that reference Auth users.
- An independently restored, consistent application-and-Auth backup is still required before a hosted migration. The old archive alone is not sufficient.

## Private recovery acceptance checklist
R0: obtain separate owner permission for a restricted, private staging snapshot.
R1: verify a coherent backup of relevant roles, schema, permissions, policies, application data and referenced Auth data.
R2: use encrypted storage restricted to the authorized operator; never put actual account or customer records in GitHub or CI.
R3: restore into a separate disposable PostgreSQL 17 Supabase environment, not the existing hosted project.
R4: check application counts, Auth references, all nine foreign keys, role permissions and independently verified row digests; recheck the hosted baseline for drift.
R5: verify a documented rollback independently and record the outcome.

Official procedure reference:
https://supabase.com/docs/guides/self-hosting/restore-from-platform

External provider setup, storage objects and hosted application secrets require separate planning. Do not claim full platform recovery from a database archive alone.

## Four-row ownership attestations (PRIVATE ONLY)
- P01, P02: the two original Product records.
- O01, O02: the two original Order records.
- For each row, keep a private restricted evidence packet with independently approved Store assignment, merchant-origin evidence, merchant attestation, independent reviewer sign-off and a fresh row version comparison.
- Do not infer Store from tenant-only membership, bot, group ordering or the presence of an active owner.
- In one anonymized tenant group two active owner memberships exist; even the other group with one owner is not enough to prove a unique Store assignment.
- Reuse the existing V14.4.3 offline evidence linter; it checks evidence structure only and cannot authenticate actual approvals.
- Never publish the filled private packet to GitHub, chat or CI logs.

## Hard release gate
Do not alter hosted RLS, grants, Auth, Store rows or writer RPCs until full independent restore and rollback, individual four-row ownership proof, Store schema approval and real signed JWT A/B/C/revoked acceptance have distinct approvals. Source-only tests cannot authorize migration.

Rollback of this V14.4.8 draft: close the draft pull request. No live database rollback applies because no hosted write occurred.
