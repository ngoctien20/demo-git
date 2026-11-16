# TIEN404 AI — V15.2-ADV.6C-RPC.4
## Independent External Caller Evidence × Private Hosted Acceptance Readiness × Signed Revocation Authorization

**Checkpoint:** 16/11/2026 JST  
**Lifecycle:** EXPERIMENTAL / OPEN DRAFT / NO SEND / NO REAL JWT / NO BACKUP EXPORT / NO SUPABASE CHANGE  
**Parent:** RPC.3 PR #186, SHA `7300d9e6feaaf9d8601721bd544d73c1d36f80a0`  
**Project:** `ifxlvrhyjhbzbrkdsida`

## 1. VERIFIED — Read-only hosted and caller evidence

- `public.qa_shop_b_zalo_claim(uuid,text,text,text)` remains **SECURITY DEFINER** and callable by `anon`; not callable directly by `authenticated` under inspected privileges. Existing Vault header secret gate remains in place; no confirmed exploit.
- Supabase Security Advisor: 1 warning `anon_security_definer_function_executable`, 2 warnings `authenticated_security_definer_function_executable` for other functions.
- PostgreSQL `track_functions=none`; 0 tracked calls would not prove absence.
- Published n8n `TIEN404_ZALO_BOT_LAB_V1_STAGING` `yIJk8LvJoLF40Z62` active version `8ca4a6f6-ab3f-42f1-8637-d4f5db790a3e` still contains enabled `Zalo V2 Shadow (Owner Gate Only)` executeWorkflow node. Published n8n V2 `OgDZNSAvKEvhnAvn` active `f00ba506-c52a-4340-9a0c-809fd9c6ea9a` still contains enabled HTTP RPC node `Submit pending claim for Shop B`.
- Supabase 24h aggregate logs **2026-11-15 07:30:00Z through 2026-11-16 07:30:00Z**: `postgres_logs` 46 records / 3 literal function-name markers, `postgrest_logs` 7 / 0, `edge_logs` 157 / 0. **These are unclassified literal markers, NOT proof of successful RPC calls or caller identity.** The PostgreSQL markers can originate from our own metadata audit.
- `public.stores` / `public.store_memberships` still absent. Both private synthetic Owner pairing functions exist, but no authorized Owner A/B JWT/RLS negative proof or approved hosted claim/confirm run is on record.
- No live changes made to Supabase hosted, n8n Published, Cloudflare, credential/secret, provider traffic or real customer data.

## 2. REUSED — Prior gates, not rebuilt
- RPC.3 `qa/v152-rpc3/private-caller-attestation.cjs` verifies offline signed caller evidence **metadata only**, not primary evidence truth.
- RPC.3 `qa/v152-rpc3/hosted-two-step-revocation-decision.cjs` maintains separate PRE_REVOKE and POST_REVOKE hard-denial gates.
- RPC.2 `qa/v152-rpc2/pg17-private-pairing.integration.test.cjs`: disposable PostgreSQL 17 transactional claim/confirm proof, NOT hosted; retry and single-writer robustness only synthetic.
- RPC.1 signed pairing capability and ADV.6 canonical Gateway remain source-only, not connected to published n8n.

## 3. IMPLEMENTED — Private signed one-time REVOKE INTENT (NOT authorization)
Source: `qa/v152-rpc4/private-signed-revocation-intent.cjs`.

The design binds exactly:
- Supabase project `ifxlvrhyjhbzbrkdsida`.
- Immutable parent SHA `7300d9e6feaaf9d8601721bd544d73c1d36f80a0`.
- Function `public.qa_shop_b_zalo_claim(uuid,text,text,text)`.
- Intended change **only**: `REVOKE EXECUTE FROM PUBLIC, anon`, not blanket function/schema rights.
- Six independent caller and hosted-readiness evidence domains, opaque refs and SHA-256 (no JWT, raw logs, PII or credentials).
- Three independent, out-of-band enrolled signing roles: CONTROLLER / SECURITY_REVIEWER / DB_OPERATOR; 5-minute maximum signature validity, random nonce and a callback for atomic replay protection.
- All signers in unit tests are **synthetic Ed25519 key pairs** generated inside CI; no real human signer, real enrollment registry or durable approved server ledger has been configured.
- Crypto validation only returns `THREE_SIGNED_INTENTS_REVIEW_ONLY_NOT_AUTHORIZATION`. Even all-green claims do not provide real authorization or confer privileges. The methods `revoke`, `issueAuthority`, and `sql` explicitly throw and cannot access any database.

The operation-specific real grant must be issued by a **separate independently authorized external change controller**, with private real evidence inspection, user approval, signer enrollment, HSM/KMS custody as appropriate, durable nonce consumption, exact time-limited operation and rollback policy. None exists in this Draft.

## 4. IMPLEMENTED — Read-only evidence classification
`qa/v152-rpc4/read-only-evidence-baseline.json`: currently observed public metadata (RPC privileges; two n8n Published versions; 24h aggregate log markers; missing hosted Store/JWT/backup/rollout proof). No secrets, user data, sender IDs, headers or raw tokens.

`evaluateHostedReadiness()` reads the trusted-in-form snapshot but treats its contents as untrusted assertions. It returns **NO_GO** on current facts and cannot authorize real execution even with fabricated all-green proof. Separate real private operator attestation is mandatory.

## 5. Private evidence packet — proposed primary sources for independent verification

| Domain | Private operator evidence to inspect | Current |
|---|---|---|
| n8n | All current Published/Draft call paths, run versions, dynamic expressions, credential-type usage and archived revisions | Current accessible 114/114 audited in RPC.2; history/global scope unknown |
| Cloudflare | All accounts, Worker routes and actual deployed source including aliases/dynamic requests; relevant runtime logs | 23 accessible script representations reviewed in RPC.2; external scope unknown |
| Supabase | Edge dependencies, Data API source, request logs with agreed observation period and API endpoint attribution | One Edge function and 24h aggregate only; caller attribution absent |
| Operator scripts | Audit manual scripts and authorized deployment automations | No independent certification |
| Third-party clients | Enumerate external integrations, tokens by scope (not values) and historic callers | No independent certification |
| Recovery + hosted | Real Owner A/B JWT/RLS same-tenant proofs, owner confirmation, private role, backup/restore, single-writer canary/rollback | BLOCKED |

Each domain requires a privately stored immutable artifact and an independently verified digest. No artifact links or signer credentials go into public GitHub/CI logs. A signed statement **about** these proofs is not proof that the underlying observation is accurate.

## 6. Individually authorized operation decision — stage sequence (PROPOSED ONLY)

1. **Read-only private intake:** Controller, independent Security Reviewer and Channel Operator establish completeness and authenticity of real request/caller observations for the agreed period. Resolve every dynamic/external caller. The public n8n V2 writer cannot be disabled before compatibility proof.
2. **Hosted Store/JWT proof:** Define approved Store ownership schema and real Owner A/B test sessions; verify positive and negative JWT/RLS including same-tenant cross-shop denial, expired/revoked session; never use `service_role` as the tenant identity.
3. **Backup:** Controller separately approves one encrypted export destination/scope/retention/cost/TTL; a named Backup Operator exports privately and independently restores. A backup approval does not approve a GRANT/REVOKE.
4. **Private pairing service:** Stage provider-specific signature verifier, canonical account/Store binding, durable idempotent claim and separate authenticated Owner confirm. Never trust client/model Store fields.
5. **Single-writer shadow/canary:** Compare statuses without a second write; later switch one writer per event under separate approved change window, preserve rollback and monitor auth failures and pairing errors.
6. **Exact signed revocation authorization:** Controller + independent Security Reviewer + DB Operator separately approve target-function-only privilege change; register in durable private ledger, enforce TTL and verify consumption. No synthetic QA packet is accepted as authorization.
7. **POST-REVOKE acceptance:** independently verify `anon` REST denial, authorized private pending pairing, separate Owner confirmation, cross-store failure, event replay failure and Supabase Advisor resolution, with operator-controlled rollback.

## 7. QA, status and operational restrictions
- New 20 negative signature/role/scope/replay/hosted-gate tests; inherited RPC.3 and RPC.2/PG17 regression. Mark TESTED only after exact SHA CI logs.
- Static CI guards for no outbound network, no SQL executor, no Hosted writes or provider sends.
- Keep a distinct intentionally blocked hosted revocation job; red eligibility is policy, not failed unit tests.
- **VERIFIED:** current privileges, Published caller, actual aggregate log counts, missing schema.
- **IMPLEMENTED:** source-only review-intent, evidence metadata schema and DO NOT APPLY SQL plan.
- **BLOCKED:** real private caller completeness; hosted Store Owner proof; one-time backup; private role; canary; independent signed authorization; actual RPC revocation.

**Release decision: NO-GO.**
**Approval:** none for real database, Published, backup or provider operations.
**Rollback:** close the child Draft PR; no hosted state changed.

## 8. Checkpoint and next milestone
Checkpoint: `V15.2-ADV.6C-RPC.4-SOURCE-ONLY`.
Next milestone proposed: `V15.2-ADV.6C-RPC.5 — Real Private Operator Evidence Review × Hosted Store Isolation Remediation Plan × Approved Canary Preflight`; do not proceed to deployment without action-specific approval.
