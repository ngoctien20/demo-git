# TIEN404 V18.0-P0V — Private Access Origin Approval × Trusted Server Session Adapter × Real Owner A/B UAT Admission

**2026-11-18 JST · SOURCE-ONLY / READ-ONLY SECURITY INTEGRATION CANDIDATE / REAL OWNER A/B NO-GO / PRODUCTION NO-GO**

Parent: [Draft PR #385](https://github.com/ngoctien20/demo-git/pull/385) at P0U checkpoint 1170754c871f2eaa43321eb8ecb6660abf35c6e3. Keep existing services, branches, user accounts and workflows. No new public endpoint or separate production service.

## 1. Read-only actual environment verification

| Source | Independently verified facts | Interpretation |
|---|---|---|
| GitHub | Existing PR #385 remained OPEN DRAFT, P0U at documented exact HEAD | Build on the current draft; do not merge |
| Render | tien404-data-staging still LIVE at dep-dbqj9plg1s2s73egr30g, source ab940a95dae8afdff426bc6ac71693833d5348ce, auto deploy OFF, public allowlist 0.0.0.0/0 | Direct Render origin still publicly routable; there is no protected P0V endpoint on it |
| Cloudflare Access | Read-only listing of 4 applications, none target/render-protect the Data Gateway origin | Neither Access proxy claims nor browser CORS alone prove origin protection; separate narrowly scoped approval needed |
| Supabase staging | Read-only aggregate: one tenant with 2 eligible active owners but only 1 with an existing nonexpired-looking auth.sessions row; second tenant has 1 owner/session | Only one candidate session in the same-tenant pair; no signed JWT possession, revocation proof or independent consent |
| Supabase auth.sessions schema | id and user_id UUID; not_after timestamptz nullable; created_at timestamptz | Supports a server-owned exact-identity session lookup contract, NOT authority by itself |
| Commerce | No independently proven canonical Store A/B ownership schema or Store authorization | Cannot grant cross-channel order lookup or assert isolation |

No raw session/user/customer IDs, PII, bearer tokens or credentials were exported. Founder already confirmed two distinct existing QA accounts in earlier phase. Do not create redundant accounts.

## 2. P0V implementation, intentionally source-only

- **qa/v180-p0v/trusted_server_session_adapter.py:** Python async trusted lookup designed for an *externally approved* least-privilege server-owned psycopg connection factory. It uses a hard-coded SQL SELECT against auth.sessions, both signed JWT subject and session UUID as UUID-bound parameters, LIMIT 2, transaction-local READ ONLY, statement timeout 2000 ms, lock timeout 1000 ms, no write path. It reuses the P0U snapshot assessor, refuses malformed/absent/duplicate/expired sessions and redacts backend errors. It creates NO credentials or DB connection itself, and is NOT imported by deployed FastAPI.
- **Cross-version security correction:** changed P0T ProtectedAuthCandidate trusted session port from lookup_current_auth_session(session_id) to lookup_current_auth_session(session_id, verified_subject_id); updated P0T/P0U fabricated port tests. This ensures the trusted lookup is subject-scoped **before querying**. Recheck both at admission and correlation.
- **qa/v180-p0v/test_trusted_server_session_adapter.py:** synthetic driver that asserts SQL shape, read-only transaction, exact UUID pair, timing constraints, rejection of backend exceptions and SQL-shaped input, no case that upgrades Store/Auth authority from session existence.
- **qa/v180-p0v/private_origin_approval_packet.json:** approval packet containing only validated service metadata and proposed change boundaries. All security changes remain PENDING_EXPLICIT_APPROVAL, including separate Owner consent. An approval packet is NOT an approval or operational authorization.
- **.github/workflows/v180-p0v-session-origin-approval-nohost.yml:** CI fails on absent expected no-host guards and executes P0V + P0T + P0U regression tests in an isolated environment. No real JWT, Supabase DB call, hosted endpoint or cloud security-policy change.
- **Existing components unchanged at runtime:** no adapter was mounted into the deployed ops/data-platform/app/main.py; no Cloudflare Access app/policy was created; no Supabase role, grant, data, schema, account or credential was modified.

**Integration limitation:** The P0V adapter is designed to accept a server-owned DB connection factory but does not yet have one approved or configured. A future backend authorization implementation must *independently* verify cryptographic Access JWT and Supabase JWT with pinned issuer/audience/JWKS and live Auth user, and correlate current session + owner membership + separate consent. Session existence or a successfully verified offline signature alone never authorize anything. A caller cannot supply its own connection, purported verified sub, JWKS or tenant scope as policy authority.

## 3. QA evidence and scope

- [GitHub Actions P0V #44233659976](https://github.com/ngoctien20/demo-git/actions/runs/44233659976): **SUCCESS**; independently inspected job logs **140 tests passed, 0 failed**, one non-blocking Starlette/AnyIO deprecation warning. Coverage includes P0T/P0U cryptographic synthetic negative/regression scenarios and P0V exact read-only session lookup.
- Tested negative cases: malformed UUID and injection-shaped input (no query), other Owner's session, missing/expired or duplicate row, untrusted timestamp, backend timeout/error, wrong signature/issuer/audience in inherited P0U, revoked session at second check, missing consent and pair reuse. Failing backend errors are sanitized.
- **NOT TESTED:** real issued Cloudflare Access or Supabase JWT, privately authorized two Owner sign-ins, actual Supabase database credential or privileged session SELECT, real session revocation, live direct-origin access deny, distributed atomic receipts, canonical Store A/B, Messenger/Zalo order lookup, customer data changes.
- Existing planned **31 real signed JWT Store A/B UAT cases remain 0/31 NOT_RUN**. Do not confuse the 140 synthetic source cases with those 31 real Store cases.

## 4. Required explicit security-change approval, not yet received

P0V defines a *scoped approval request*, not a blanket grant. Review individual actions before deploying them:

1. **Private Access application** (Cloudflare) with exact dedicated staging QA host/path, explicit QA principals, short session lifetime, no Bypass, and independent review of existing Access policies (do not repurpose other applications). No new app or policy has been created.
2. **Non-bypassable origin enforcement** on Render: the direct Render URL must refuse any unsigned/invalid Access JWT. Approve trusted-origin signature/JWKS fetching, issuer and exact audience pinning; validate HTTP 401/403 negative tests directly against the origin without forwarding real credentials before protected route is ready. CORS/Host/Referer/forwarded-client booleans are insufficient.
3. **Least-privileged Auth session read**: approve credential handling and a narrowly scoped backend role capable of SELECT id,user_id,not_after from auth.sessions only for the private verifier, with read-only transaction, connection/TLS, short timeout, secret rotation/redaction plan, no public RPC or frontend service-role secret. Never expose the auth schema through Supabase Data API.
4. **Independent Owner A/B consent**: each pre-existing QA owner personally authorizes read-only identity/session correlation under a specified short TTL, including ability to revoke. Current A/B local P0O receipt not received. Never ask user to paste JWTs/passwords/IDs into chat, GitHub, logs or screenshots.
5. **Atomic replay-safe consent receipts**: independently reviewed private one-use server transaction, signed minimal evidence with scope no_send/no_store_read, bounded TTL and rollback/incident recovery. In-process P0T handles do not satisfy this.
6. **Hosted QA authorization** only after (1)-(5) independently reviewed and verified in staging. Any Store DDL/RLS/grant, ownership mapping or test against real customer data requires separate M0 backup/restore and an authorized rollback window.

None of these is implicitly approved by the founder choosing the phase name or asking to continue development. A founder approval is also not an authenticated consent from Owner B.

## 5. Independent Owner A/B admission plan

**Operator-preflight first:** the existing P0O local read-only check is at https://tien404-auth-staging.onrender.com/auth-evidence.html. Run in two authorized independent browser profiles; respond only LOCAL_COMPARE_PASS or the non-sensitive BLOCKED_REASON. Do not share raw receipts, JWTs, emails, user/session UUIDs, fingerprints or credentials. If the second Owner is not signed in, stop and treat it as missing session proof; never manufacture a new session.

After private hosted approvals, a *separate* authorized reviewer will check a dedicated origin from an unauthorized and authorized client: missing Access assertion, forged header, wrong signed audience, direct Render-origin bypass, timeout and rate bound; next independently signed A and B JWTs, each live Auth user/session, separate Owner consent, same tenant + distinct session/principal. Test logout or session deletion immediately before correlation and enforce denial; require durable one-use receipts before any admission PASS. Only then consider separate Store/tenant auth tests and cross-channel Messenger/Zalo no-send read-only tests.

**Current real Owner A/B admission:** NOT_RUN / NO-GO. Existing 31 Store isolation UAT: NOT_RUN. No Store authority, provider sending or production release.

## 6. Status, rollback, next step

- VERIFIED: Render deploy unchanged, Cloudflare Access app inventory, Supabase owner cohort and session schema.
- IMPLEMENTED: source-only exact read-only session adapter and repaired P0T/P0U port signature, approval packet and CI tests.
- TESTED: 140/140 synthetic offline regression cases; final branch HEAD CI rechecked separately.
- PROPOSED: dedicated Access policy/origin protections, server-owned database connection, consent service, real authorized UAT.
- BLOCKED: independent Owner A and B consent, second live verified session, real origin direct-deny, privileged session credential authorization, signed durable receipt, canonical Store A/B.
- NO HOSTED CHANGES: no Render deploy, Cloudflare Access policy edits, Supabase DDL/DML/Auth/account/key/role changes, n8n, Meta/Zalo sends, customer/order read or writes, billing, production or PR merge.
- ROLLBACK: Git revert P0V source-only commits and the contained P0T/P0U port-signature edits; no runtime rollback. For any separately approved later hosted operations, prepare a new specific rollback and M0 evidence before changes.

**DECISION: P0V_SOURCE_READER_CANDIDATE / SYNTHETIC_REGRESSION_QA_TESTED_140_OF_140 / PRIVATE_ACCESS_HOSTED_NO_GO / AUTH_OWNER_A_B_NOT_ADMITTED / PRODUCTION_NO_GO.**
