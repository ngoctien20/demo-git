# TIEN404 AI V15.2 ADV.6E — Independent Authority Enrollment & Hosted Security Certification

Checkpoint: **2026-11-16 JST**.
Lifecycle: **READ-ONLY ACTUAL HOSTED METADATA + SOURCE-ONLY REVIEW / DRAFT / NO SEND / NO REAL DATA EXPORT / PRODUCTION NO-GO**.

## 1. Parent and related work (no duplicate implementation)

- Parent [ADV.6D PR #180](https://github.com/ngoctien20/demo-git/pull/180), verified HEAD \`0ac0ccf8a909b16aa6376d41533604632cd6bf3d\`, OPEN DRAFT, 3/3 exact HEAD CI SUCCESS, 50/50 isolated offline tests. Its signer-role verification is metadata/QA only; **not actual enrolled or independently authenticated humans**.
- [ADV.6C PR #176](https://github.com/ngoctien20/demo-git/pull/176): 37/37 offline Ed25519 synthetic receipt validation, not durable approval. [ADV6B.1 PR #172](https://github.com/ngoctien20/demo-git/pull/172) hosted metadata triage, plus [ADV6A PR #169](https://github.com/ngoctien20/demo-git/pull/169) **real but disposable PG17** nonce concurrency/rollback QA. ADV6A is a sibling not included in this branch.
- [PRE-ADV6C PR #171](https://github.com/ngoctien20/demo-git/pull/171) includes RPC/caller dependency findings, and backend zero-trust security. Sibling, NOT merged.
- [PR #135](https://github.com/ngoctien20/demo-git/pull/135) synthetic multi-signature and [PR #158](https://github.com/ngoctien20/demo-git/pull/158) human-facing one-time backup request status NO-GO; no real backup/restore performed.

ADV6E does NOT create another signer system or issue private certificates. It supplies an actual-hosted *sanitized* metadata baseline plus actionable independent-review and remediation handoff.

## 2. VERIFIED read-only Supabase security baseline

Project \`ifxlvrhyjhbzbrkdsida\`, staging PostgreSQL **17.11**. Data source: **connected Supabase metadata-only SQL + Security Advisor on 2026-11-16T06:19:03Z**, not a cryptographically signed host certificate. SQL audited under privileged \`postgres\` role, never a Shop Owner JWT proof.

Minimal redacted public snapshot:
\`qa/v152-advanced-actions/adv6e-hosted-readonly-snapshot.json\`.
No customer rows, PII, bearer token, complete function body, private role secret or credential appears in it.

Observed:
- \`public.stores\` and \`public.store_memberships\` **absent**; \`public.orders\` and \`public.tenant_memberships\` **lack Store ID**. Separate Owner A/B with same Tenant cannot be isolated by a Store policy that does not yet exist.
- Dedicated \`tien404_action_private\` nonce schema **absent**. Existing \`app_private.order_idempotency\` is NOT equivalent to an approved signed-action nonce ledger.
- The following exact \`public\` functions are \`SECURITY DEFINER\`, owned by \`postgres\`, and set \`search_path=""\`:
  - \`qa_shop_b_zalo_claim(p_challenge uuid, p_code text, p_sender text, p_event text)\` — \`anon EXECUTE=true\`, \`authenticated=false\`. A body-text metadata pattern mentions Vault, not \`auth.uid()\`; caller may intentionally be an unauthenticated Zalo webhook.
  - \`qa_owner_pairing(p_shop uuid, p_action text, p_challenge uuid)\` — \`authenticated EXECUTE=true\`, \`anon=false\`. Body-text pattern mentions \`auth.uid()\`.
  - \`save_merchant_product(p_tenant uuid, p_sku text, p_name text, p_price bigint, p_active boolean, p_initial_stock integer, p_expected_updated_at timestamptz)\` — \`authenticated EXECUTE=true\`, \`anon=false\`; body text pattern mentions \`auth.uid()\`.
- Supabase linter: **1 anon-executable definer** and **2 authenticated-executable definers**; Auth leaked-password protection disabled (P1). Advisor also lists 18 RLS-on/no-policy entries in private/QA schemas (INFO; requires checking actual grants and exposure, not assumed leak).
- \`search_path=""\`, \`auth.uid()\`/Vault mentions and non-public table RLS are partial safeguards, not proofs of authorization, correct HMAC, correct nonce or absence of bypass. **No exploit attempt, public RPC invocation or function rewrite performed**.

Official references:
- https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable
- https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## 3. Implemented source QA / no authority

\`qa/v152-advanced-actions/adv6e-hosted-readiness.cjs\` checks exact-scope metadata, timestamps, three RPC names/signatures, grants vs Advisor counts, schema readiness and privileged SQL scope; refuses extra fields like \`verified:true\` or fake JWT. Reports actionable P0/P1 issues and external evidence needed.

Even hypothetical clean metadata **never** becomes a verified human enrollment, hosted Owner JWT, proof of RPC function behavior or production certification. All hosted export/restore, privilege changes, migration, Commerce/Meta/Zalo execute methods throw.

\`adv6e-hosted-readiness.test.cjs\` covers current actual sanitized metadata, changed role/function/grant drift, provenance tampering, stale snapshots, missing Store schema, no backup, independent two-Owner proof and no execution. CI inherits ADV6D/6C/6B1 and canonical action security tests. No provider/hosted access in CI.

## 4. Actionable independent authority enrollment process — HUMAN/PRIVATE, NOT YET DONE

**Never place JWT, OTP, PII, raw backups, operator secrets or private signing keys in GitHub, GitHub Actions artifacts, ChatGPT, n8n logs, or public cloud links.**

1. **Controller**: Actual whole-project authorized decision-maker is independently established via platform account/organization ownership in a *private* out-of-band channel. Verify authority to authorize all-project staging export versus a single merchant store operation; set authorized data scope and no-extra-fee condition. A user message to proceed is NOT blanket consent for data export, data modification or spending.
2. **Registrar**: Designate a real independent human/institution to validate signer identity and role using trusted organizational credentials/MFA and registered public signing keys. Registrar must NOT also act as Controller, Reviewer or Backup Operator for the same operation. Private authenticated registrar record must include unique human identity proof, issuer/trust anchor, key fingerprint, enrollment scope, expiry/revocation, and private evidence location. Our source-only metadata validators do NOT authenticate these things.
3. **Security Reviewer**: Independent authorized person/firm reviews owner credentials, JWT Auth claims and current Store model, the three RPC *complete bodies* under private controls, real caller dependencies, Vault/HMAC and replay boundary, backup coverage/restore plan, private DB role and rollback. Records explicit signed approval/rejection *for a named operation only*, not a broad AI-generated PASS.
4. **Backup Operator**: Independently verified, scoped role; does not have unrelated platform/admin privileges. Specific Controller+Reviewer-approved authorization *for one encrypted STAGING export only* includes exact source, selected Auth/Storage/extension coverage, destination with key custody, retention, cost/no-extra-spend rule, fixed operator, deadline, one-use durable lease and revocation/audit. A "complete checklist" or synthetic Ed25519 signature is NOT an executable permit.
5. **Isolated restore**: Separately authorized restore test into controlled non-customer environment; independent reviewer verifies decryptability, integrity and coverage. Never replace customer data or re-import into live staging/production by default.
6. **Store Owner A/B**: Need two independent **real signed Supabase Auth user sessions**, authenticated active membership and two distinct Store IDs, with positive own-Store and negative cross-Store READ/WRITE via non-BYPASSRLS access, including disabled/revoked sessions and malicious tenant/store IDs. Current Store schema absent: **blocked before hosted migration**.
7. **Nonce/Action**: Dedicated private DB role with scoped SQL, never service_role general permissions; host atomic nonce+Commerce effect in a single DB transaction, scope to Store and verified Owner/channel, short TTL, append-only audit; test duplicate 32-way, process restart, DB failover, compensation and provider idempotency. Disposable PG17 results in PR #169 are not hosted certification.
8. **Operation-specific decision**: Only a verified private authority system can grant one distinct operation. Separate decisions for backup export, restore, Store schema migration, DB role/grant changes, RPC ACL/function replacement and provider send. No implied approval from previous prompts or this Draft.

## 5. RPC P0 risk review and remediation plans — no executable changes

| Function | Proposed safe direction | Required dependencies and evidence |
|---|---|---|
| \`qa_shop_b_zalo_claim\` | Assess whether anonymous RPC is intentional for signed Zalo claim. Prefer server-verified relay + private RPC scope, raw webhook body HMAC/event id and atomic replay, if compatible. Only then consider removing public EXECUTE; never abruptly revoke while current callers exist. | Current Zalo ingress + n8n workflow caller inventory, HMAC/Vault custody check, webhook signature/nonce QA, alerting, canary, rollback function ACL |
| \`qa_owner_pairing\` | Recheck \`auth.uid()\` with active JWT session and canonical Store membership; restrict to actual Owner and short-lived single-use challenge; remove cross-shop privileges. | Two real Owner sessions, tenant/Store ownership and revocation tests, positive owner pairing, negative guest/manager/cross-Store, rollback |
| \`save_merchant_product\` | Only allow exact tenant and Store Owner/Manager authority, validated VND price/stock fields, optimistic version and row-level ownership; deny arbitrary tenant/SQL, self-authorization and invalid total. | Actual catalog/price app role paths, Shop A/B negative writes, role conflicts, concurrency, caller compatibility, audited staged rollout |

**Options only, not decisions:** revoke direct EXECUTE (including inherited PUBLIC defaults), switch to SECURITY INVOKER only where equivalent audited RLS exists, or retain tightly constrained intentional public ingress. Any choice needs Security Reviewer, Controller, approved backup+restore, dependencies mapped and QA canary. No live GRANT/REVOKE/ALTER or PG migration in ADV6E.

## 6. Concrete release gates and required private evidence

1. Registrar and verified human signers: **BLOCKED — no actual external identity enrollment**.
2. Authorized Controller + Security Reviewer + eligible Backup Operator: **BLOCKED — no human approval attested**.
3. One-time encrypted STAGING backup **plus** approved isolated restore and private custody: **BLOCKED — not executed**.
4. Real hosted Canonical Stores schema, Owner A/B signed JWT, same-Tenant cross-Store denial, revocation: **BLOCKED — schema absent**.
5. Least-privilege private DB role, hosted atomic nonce+business-effect and recovery: **BLOCKED**.
6. Full RPC body/dependency/negative QA and authorization for each exact signature: **BLOCKED**.
7. Provider entitlement + genuine merchant UAT + independent release approval: **BLOCKED**.

**Production/Commerce action status remains NO-GO even if all offline tests PASS.** Request new explicit scope-specific approval only after independent evidence has been privately reviewed. Never request or publicly store raw credentials.

## 7. QA, changes, rollback and next

This Draft adds only sanitized metadata and offline risk assessment/doc tests. It neither promotes ADV5/ADV6 sibling branches nor updates hosted Supabase, n8n Published, credentials, billing, Cloudflare, Meta/Zalo sends, real customer data or secrets. Check GitHub Actions at final HEAD before saying TESTED.

Rollback: close new child Draft PR, leave #180/#176/#169/#171/#158 and existing public/hosted services unchanged.

**Next focus** should be one tangible external dependency (human security reviewer designation, one-time backup authorization, approved Store schema migration and two real Owner accounts) rather than multiplying synthetic certificates. This checkpoint alone CANNOT satisfy the independent Authority Enrollment or Hosted Security Certification milestone.
