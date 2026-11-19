# TIEN404 V18.3.6Q — Owner + Independent Reviewer Decision Handoff

**Status: REQUEST PACKAGE ONLY — NO APPROVAL RECEIVED**  
**Scope:** Staging Supabase project `ifxlvrhyjhbzbrkdsida`; no customer/merchant PII or actual Supabase Auth sessions.

## Decision A — Separate staging SECDEF body review

Requested action (NOT executed): a human reviewer privately inspects the body of **only** the four precisely identified `public` SECURITY DEFINER functions in O's manifest: `qa_owner_pairing`, `qa_shop_b_zalo_claim`, `save_merchant_product`, `tien404_tester_track_change`. In an authorized private workspace only; bounded 60-minute access, independently verified owner and reviewer, version/fingerprint checkpoint, redacted evidence output. Never publish function bodies, embedded values, credentials, parameters with PII or Auth session identifiers in GitHub or ChatGPT.

**Required approvals not yet obtained:** authenticated project owner approval, independent qualified human reviewer identity, per-function scope hash, private evidence retention and access log, read-only grant inventory snapshot.

**Explicit prohibitions:** no SQL INVOKE, GRANT/REVOKE, DDL, service-role issuance, JWT/session queries, production release or provider sends.

## Decision B — Separate disposable local GoTrue UAT runtime creation

Requested action (NOT executed): create a **brand new local disposable** Supabase GoTrue/Auth + PostgreSQL stack, synthetic identities only, pinned CLI and image digests, no external network delivery/SMS/SMTP/webhook, loopback only, no real tokens, and independent cleanup verification. Run the 20 scenarios GT01–GT20 only AFTER resource/cost and reviewer approval.

**Required approvals not yet obtained:** explicit local resource/test-account creation consent, approved operator, independent reviewer, image digest/version preflight, egress/teardown verified, cost ceiling where applicable.

**Explicit prohibitions:** do not link to existing staging project, reuse service-role credentials, clone real Auth users or modify existing Docker volumes.

## Decision C — Production RPC crypto architecture (review only)

Status: **NO-GO**. The Q signed RPC uses a committed **PUBLIC fixture HMAC key**, intentionally unsuitable for real security. A human security review must choose a supported verifier/key-custody model, secret transport, SQL definer privileges, revocation/rotation policy, trusted Store A/B proof and incident rollback.

Do not infer a production signature/key or approve privileged RPC changes from 721/721 disposable QA assertions or from an all-true metadata checklist.

## Gate progression

`REQUEST_PREPARED → REAL_OWNER_AND_REVIEWER_VERIFIED → PRIVATE_A_OR_B_APPROVED_SEPARATELY → TESTED_WITH_REDACTED_EVIDENCE → SECURITY_REVIEW → CANDIDATE`

`PRODUCTION` is NOT a reachable state from this handoff alone.

**Current verified facts:** no real owner/reviewer approvals; no GoTrue runtime launched; no function body read; no service-role use or permission change; Draft PR #461 remains unmerged.

**Rollback:** close PR #461; all new tests only touched disposable PostgreSQL 17. No linked system changes.
