# TIEN404 AI V21.11 — Real Meta Admission, Owner A/B JWT, Staging Approval Gate

**Checkpoint:** 2026-11-23 (JST). **Scope:** Draft-only, evidence/QA/documentation. **Release:** NO-GO. No hosted migration, no Meta send, no merchant rollout.

## 1. Verified checkpoint correction

PR #493 was MERGED into develop on 2026-11-22 21:11:47 UTC (2026-11-23 06:11 JST), merge commit 078c91d8777d08ea82058cc6ee68b08a6868276d; it is not an open draft. Its final four checks all succeeded, including V23 web/owner QA.

Direct staging read-only audit on 2026-11-23: Supabase tien404-staging PostgreSQL 17.11 still contains one active Messenger channel, but none of the reaction Page draft/Meta installation proof/OAuth nonce tables or Page-list/draft RPC. Messenger workflow Z7FdV7uDvApfbURQ published version 1f4069a5-5e74-4c79-935b-40f02b3582d8; candidate draft 41bcea84-703d-40bc-be2a-71f84ca4e2d8 continues ALL OFF.

A GitHub merge and green CI **do not** mean any reaction sender was deployed.

V21.11 starts from develop at 9355974674f0a3dd39a274fdaa0874fd6d9756a2 into work/v2111-real-evidence-admission-qa-20261123. Do not modify merged PR #493 or overlap with concurrently active V26/Commerce branches.

## 2. Real Meta Test App and Page authority — BLOCKED

Current connected browser lists no Meta Developers App configuration tab. No authenticated Graph calls were performed. The owner viewing Meta Business Suite Inbox is not sufficient proof that TIEN404's app is installed and authorized for the Page.

An authorized trusted gateway must gather READ-ONLY proof: app ID/mode/review/tester eligibility; actual User OAuth token app binding, expiry, scopes and granular per-Page grants via debug_token; exact Page ID with MESSAGING task via me/accounts; app present under Page subscribed_apps with messages field; pending one-time OAuth nonce and installation ID bound to owner, store, tenant and Page. No Meta POST, Page-subscription edit or token upload into GitHub/ChatGPT.

Trusted server receipt signing and the Page owner accepting a specific reaction policy are different gates. Even positive read-only Graph evidence cannot authorize publishing a reaction or enabling provider sends.

References:
https://developers.facebook.com/docs/graph-api/reference/debug_token/
https://developers.facebook.com/docs/graph-api/reference/page/subscribed_apps/
https://developers.facebook.com/docs/graph-api/reference/page/conversations/

## 3. Real Owner A/B Auth JWT acceptance — BLOCKED

An offline GET-only harness already exists in qa/reactions/owner-auth-jwt-readonly-uat.mjs. It is pinned to the staging project and accepts only publishable API keys and two separate authenticated JWTs; it checks each identity with the Supabase Auth GET /auth/v1/user endpoint and validates store ownership/cross-store visibility by GET only.

**This was not executed with two real authorized owner sessions**; SQL role simulation or fake JWT mock tests are NOT real Auth acceptance. No passwords/JWTs should be pasted into this conversation. The actual two users and their store rights must be explicitly approved for this UAT.

## 4. Backup, restore and staging migration — independent approval required

Historic protected staging backups and independent V20/Config Core/V23 restore-test rehearsals have been evidenced. They do not prove the **same, freshly encrypted V21.11 pre-migration backup** has been successfully restored into an isolated disposable PostgreSQL environment.

Before staging SQL: authorize new encrypted snapshot with checksum and safe retention; restore that exact archive to an approved isolated target and verify schema/roles/RLS; review SQL candidates db/reactions 10/20/30/40, private writer privileges and rollback; receive explicit owner/security sign-off for staging migration. A potential paid isolated database requires cost approval.

Config Core was previously deployed by owner-approved GitHub Actions using direct psql, not Supabase CLI-managed migrations. Therefore do NOT replay Config Core or change supabase_migrations.schema_migrations automatically. Official guidance confirms migration repair adjusts tracking records, not SQL:
https://supabase.com/docs/guides/deployment/database-migrations

## 5. New V21.11 credential-free evidence checklist

- qa/reactions/v2111-evidence-status.json explicitly marks seven independent real-world gates BLOCKED. No invented Page IDs, JWT, access token or fake proof digest.
- qa/reactions/v2111-evidence-review.mjs is a pure, OFFLINE human-review helper: checks evidence record schema, missing proofs, approved reference format, SHA-256 and freshness. It cannot authenticate a claimed issuer or actually verify Meta/Supabase evidence. Therefore even all supplied records marked VERIFIED return only INDEPENDENT_REVIEW_REQUIRED.
- Its outputs canApplyStagingMigration, canIssueMetaInstallationProof, canSendMetaReaction and canEnableReaction remain FALSE unconditionally.
- qa/reactions/v2111-evidence-review.test.mjs contains synthetic negative/positive regression cases. CI must PASS before describing it as TESTED.

**Meaning:** This file is a work queue for evidence collection, not a cryptographic attestation, an approval system, or a deployment switch.

## 6. Status and rollback

VERIFIED: prior PR merge; four previous CI; real staging reaction schema absent; n8n Shadow OFF.

IMPLEMENTED: isolated V21.11 evidence checklist and offline QA on a new branch.

BLOCKED: actual Meta App/Page OAuth attestation, two distinct real Owner JWTs, fresh same-file backup restore, separate security and staging migration approval, any provider send.

Rollback: revert only V21.11 evidence/code/test/CI/docs. No hosted DB, Meta or Messenger rollback is needed because no live write occurred.

No approval for production reaction publish, page-level consent or automatic Meta reactions is inferred from any CI result. Continue with real owner-authorized read-only sessions before requesting staging DDL.
