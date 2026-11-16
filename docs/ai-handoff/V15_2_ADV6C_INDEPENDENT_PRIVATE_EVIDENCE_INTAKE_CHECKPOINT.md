# TIEN404 AI V15.2 ADV.6C — Independent Private Evidence Intake

**Checkpoint 2026-11-16 JST.** State: **DRAFT / SOURCE-ONLY / NO SEND / NO HOSTED MUTATION / NO PRIVATE DATA IMPORT**.
Scope: Optional Advanced Action Gateway. Never enabled by default for Sales Lite.

## 1. Existing evidence sources and nonduplication

- Parent [ADV.6B.1 PR #172](https://github.com/ngoctien20/demo-git/pull/172), exact verified parent HEAD \`dd29d1e51a70f5ea101a0697eced3ff0bd67de08\`, 3/3 exact-head CI SUCCESS. Existing hosted metadata triage remains fail-closed. This child does NOT rewrite Owner evidence and action components.
- Existing [ADV.6B PR #165](https://github.com/ngoctien20/demo-git/pull/165) owner-evidence-gate and disposable PG17 tests: source PASS, hosted cert BLOCKED.
- Separate [ADV.6A PR #169](https://github.com/ngoctien20/demo-git/pull/169) real disposable PG17 10/10 PASS, including synthetic rollback transaction; **not** merged and not proof of hosted Commerce atomicity.
- Separate private-intake predecessor work: [PR #135](https://github.com/ngoctien20/demo-git/pull/135) synthetic dual Ed25519 signing; [PR #158](https://github.com/ngoctien20/demo-git/pull/158) Sales Lite one-time backup **NO-GO** review, [PR #171](https://github.com/ngoctien20/demo-git/pull/171) PRE-ADV.6C security tool boundary and P0/P1 audit. No copied or fabricated real approvals, backups or signers, and no automatic merge of sibling PRs.
- Direct connected read-only Supabase metadata from ADV.6B.1: PG17.11, no canonical \`public.stores\`/\`store_memberships\`, no \`store_id\` on public Orders/Membership, no \`tien404_action_private\`; privileged \`postgres\` metadata session cannot certify Owner JWT-RLS. SECURITY DEFINER \`qa_shop_b_zalo_claim\` callable with \`anon\`; \`qa_owner_pairing\` and \`save_merchant_product\` callable by \`authenticated\`. Privilege exposure requires review, **not proof of exploit**.

## 2. What ADV.6C adds

\`qa/v152-advanced-actions/adv6c-private-evidence-intake.cjs\`:
- Strict **eight-lane** reference-only manifest for Owner A Auth/session, Owner B Auth/session, negative cross-Store RLS, Controller backup approval, encrypted export and *isolated restore*, private DB role review, hosted nonce transaction proof, and SECURITY DEFINER RPC risk review.
- Strict project digest, one specific review purpose, unique SHA-256 evidence digests, ordered private-only opaque references, captured time, short-lived 15-minute review scope; reject raw JWT/accessToken, email/PII, publicly accessible URL, arbitrary keys and forged \`verified:true\`.
- **Three independently enrolled signing roles**: Platform Controller, independent Security Reviewer, Backup Operator. Inject runtime trusted Ed25519 public keys from external private custody; reject revoked key, mismatched purpose, duplicate principal digest/public key, altered digest, stale evidence or invalid signature. No private key generation or enrollment into hosted system and no private records persisted here.
- Input validation and successful cryptographic checks can produce only \`PENDING_EXTERNAL_INDEPENDENT_VERIFICATION\`; the module **cannot establish trust in the supplied registry or assess real private source content**. No self-reported signed JSON may be treated as signed authorization.
- Output contains only status/blocker codes, not references, hashes, signer IDs, evidence contents, tokens or signatures.
- All \`exportBackup\`, \`restoreBackup\`, \`migrateHosted\`, \`grantDbRole\`, \`changeRpcPrivilege\`, \`executeAction\`, \`sendProvider\` APIs throw \`ADV6C_NO_PRIVATE_OPERATION_EXECUTOR\`.

\`adv6c-private-evidence-intake.test.cjs\`: synthetic Ed25519 keys only, no real identity, private data or spend. Test negative cases include forged signatures, altered project/purpose/digests, role impersonation, missing backup restore lane, duplicate evidence, new approval lease replay, privilege changes and response redaction. CI adds inherited Owner/metadata/action QA.

## 3. PRIVATE collection SOP — not a request to send secrets through ChatGPT

**NOT IN THIS REPO, GitHub issues/Actions artifacts, ChatGPT, n8n execution logs, public GDrive or email:**
actual JWT/access/refresh tokens; OTPs; provider HMAC secrets; service-role keys; customer names, phone/address; PII; raw database dumps; private attestation full documents.

**Collector:** project Controller designates an independently verifiable operator and Security Reviewer via an existing private out-of-band channel. Do not infer this from the project's own prompt, typed checkboxes or a public GitHub role.

**Step A — independent Owner/Store evidence**: two genuine distinct Owner principals, own active authenticated Supabase sessions and Store A/B membership, both positive queries and negative cross-Store requests over real non-bypass authenticated backend path. Do not include JWT in receipts or logs; store session check results privately. Store-level schema does not yet exist; this step is BLOCKED pending a separately reviewed and authorized Store migration.

**Step B — backup decision**: Controller signs a *one-time backup export REQUEST* describing exact staging project scope, Auth/Storage/extensions/data coverage, retention, encrypted destination, budget, responsible Operator, cancellation and minimal exposure. Security Reviewer signs separately. The request is not an export permit; only a trusted real operator approval process can authorize one specific export with durable single-use lease. **No actual export or isolated restore has been performed by ADV6C.** Restore is independently scoped and separately authorized.

**Step C — Security Reviewer**: independently review actual RPC function bodies and caller dependencies, per-signature grants, RLS and private schema, planned change and rollback. In particular, do not revoke existing \`anon\` pairing without verifying its webhook/HMAC guard and effect on existing Messenger/Zalo flows.

**Step D — private DB role**: review least-privilege dedicated runtime role, connection custody, rotation, schema exposure, atomic nonce INSERT/RETURNING, RLS and eventual Commerce business transaction idempotency; no hosted GRANT/REVOKE/DDL until specific signed Controller+Security approval and backup proof.

**Step E — receipt review**: only opaque private document references and SHA-256 digests move into an approved *private* audit registry. The offline verifier uses externally enrolled public keys to check integrity; a human independent reviewer still verifies authority, actual JWT/Store requests, backups, recovery evidence and signatures. The public GitHub repo contains ONLY synthetic fixtures.

**Step F — authority separation**: one receipt for \`PRIVATE_EVIDENCE_REVIEW\` never authorizes \`ONE_TIME_BACKUP_EXPORT_REVIEW\`, \`HOSTED_STORE_MIGRATION_REVIEW\`, \`PRIVATE_NONCE_DB_ROLE_REVIEW\` or \`RPC_PRIVILEGE_CHANGE_REVIEW\`. Even receipts for these *review* purposes authorize **zero operations**. A real durable per-operation single-use authorization service is not implemented.

## 4. Receipt properties vs production requirements

| Component | Source QA possible | Actual independent hosted certification |
|---|---|---|
| 8-lane manifest structure, time/digest/role checks | Yes | NO |
| Three synthetic Ed25519 signatures | Yes | NO (signer authority and real enrollments absent) |
| Owner JWT A/B and cross-Store RLS | No | NO |
| Authorized real backup and independently tested restore | No | NO |
| Private DB role and hosted atomic nonce business transaction | No | NO |
| RPC SECURITY DEFINER dependencies/least privilege certified | No | NO |
| Durable one-time approval lease/revocation audit | No | NO |
| Meta/Zalo sending, real Orders/Stock or billing | Disabled | NO |

**No hosted migration, credential use, real data export, production change or payment authorization inferred from a PROPOSED milestone.**

## 5. Acceptance and rollback

TESTED only after exact child HEAD CI success for Ed25519 QA negative cases, stale/forged/duplicated identity refusal, redaction, fail-closed operations, and inherited ADV6B/6B.1 action tests. Distinguish a cryptographically valid signed *synthetic* reference from true external authority.

Rollback: close Draft child PR; parent PRs #172, #165, #169, #135, #158, #171 and all Published/hosted resources remain unaffected.

**Next conditional milestone:** authenticated, privately authorized Owner/Controller/Security evidence enrollment, limited role review and backup *decision* via trusted channels. A real export, hosted role/grant migration and provider send each require separate explicit approval and independent test evidence.
