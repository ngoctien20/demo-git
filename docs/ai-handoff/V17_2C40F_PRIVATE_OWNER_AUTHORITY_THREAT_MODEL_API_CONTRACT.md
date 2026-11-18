# TIEN404 AI — V17.2C.40F Private Owner Authority Threat Model × S3 Transition API Contract

**Date:** 2026-11-18 JST  
**Parent:** V17.2C.40E (S3 locked, 22/22 PASS)  
**Draft PR:** #392  
**Status:** DESIGN / SOURCE-ONLY / NO HOSTED SERVICE / NO AUTHORITY.

## 1. Decision and objective

Current project decision remains **S3**. The project operator selected S3, but that is a project-level decision only, not proof of legal ownership or a verified Supabase owner session.

V40F reviews the existing V17.2C.21 dependency-injected consent backend and V17.2C.24 HTTPS route candidate, defines the future private owner transition API, and records its threat model. The new API contract is **NOT_APPROVED** and all routes are disabled. No service URL, credentials, DB branch, schema, endpoint, or provider integration is created.

## 2. Existing implementation audit — verified source, not hosted runtime

### V17.2C.21 — `v172c21-protected-consent-backend.cjs`

**Implemented in Draft source:**
- Requires injected adapters for session verification, Store authority resolution, challenge verification, explicit consent persistence, trusted authority/evidence/receipt reads and reviewer-session verification.
- Requires an explicit `accept` action and an opaque challenge.
- Requires server adapter output to attest active/verified session, session-ID verification and future expiry.
- Resolves Tenant/Store/slot from the server adapter rather than accepting them from request JSON.
- Requires challenge proof and persisted consent receipt before returning `PRIVATE_CONSENT_RECORDED_NOT_UAT_GO`.
- Reviewer path requires a current, independent reviewer session and rejects a reviewer who is also an owner.

**Security limitations:**
- The booleans and opaque refs returned by injected adapters are trusted only if a real protected server implements and verifies them. The module itself does not validate JWT signatures, query Supabase Auth, or prove current `auth.sessions` state.
- Challenge verification and receipt persistence are separate adapter calls. The future adapter must guarantee atomic single-use consumption plus append-only consent event persistence, or implement a transactionally safe idempotent protocol. A consumed challenge with a failed receipt must remain DENY and must never create partial authority.
- `reviewPair` reads authority, evidence and receipts in parallel. A real implementation must pin a consistent version/snapshot and reject stale or mismatched evidence.
- The module returns a consent-recorded status only; it is not a Store grant or real A/B UAT approval.

### V17.2C.24 — `v172c24-private-consent-https-handler.cjs`

**Implemented in Draft source:**
- Private-only POST paths for QA intake and reviewer pair review.
- Exact configured Origin/target checks, no query/hash, strict route allowlist, JSON-only bounded body, bearer syntax validation, rate-limit and deployment-gate adapters.
- Redacted responses and no-store/security headers.
- Request body bounded by a streaming reader, including chunked requests without Content-Length.

**Security limitations:**
- This is a Request/Response handler candidate, not a deployed HTTPS service. The handler does not itself provide TLS termination, trusted reverse-proxy configuration, Cloudflare Access, network isolation, secrets storage, persistent rate limiting or production observability.
- Exact Origin checks are defense in depth; the deployment must establish trusted scheme/host and must not trust caller-supplied forwarding headers. Cookie-based sessions would additionally require explicit CSRF controls.
- The route's current scope and paths are QA-specific. Do not repurpose or publish them as the future real owner authority API.
- Synthetic route tests are not external TLS, live Supabase JWT, independent owner consent or real Store A/B evidence.

**Verified current deployment state:** both modules are source candidates in Draft PR #392. Their historical checkpoints state NOT DEPLOYED. No hosted endpoint or real JWT UAT is admitted.

## 3. Threat model and mandatory controls

| Threat / failure | Attack or unsafe condition | Required control before private deployment | Fail-closed behavior |
|---|---|---|---|
| Spoofed / forged JWT | Caller submits fake, expired, wrong-audience or wrong-issuer token | Verify through trusted Supabase Auth server path; validate issuer, audience, signature, expiry and session ID; never trust client claims | DENY |
| Stale or revoked session | Logout, user deletion, token refresh or session revocation not reflected in old JWT | Re-check current session/revocation state for sensitive actions; use `session_id` against `auth.sessions` where strict post-signout enforcement is required | DENY |
| Owner spoofing | Caller claims owner role or Store membership in JSON or user-editable metadata | Resolve `auth.uid()` and active membership from server-controlled records; do not authorize from `raw_user_meta_data` | DENY |
| BOLA / IDOR | Authenticated owner reads another Store by changing Store/Order ID | Server-derived Store scope; composite Tenant+Store lineage; Store membership checks in every query/RPC and RLS | DENY |
| Cross-tenant confusion | Tenant alias or channel alias is coerced into a canonical Store | Revisioned namespace crosswalk, unique active target, tenant/store consistency and source proof | DENY / QUARANTINE |
| Challenge replay | Re-submit a captured challenge or parallelize two accepts | Random single-use challenge; bind to actor, session, decision version, Tenant, Store, operation and expiry; atomic consume | DENY replay |
| Partial consent persistence | Challenge consumed but receipt not written, or receipt written twice | One DB transaction for consume + append-only consent event + idempotency receipt; rollback on any failure | DENY; no grant |
| Race / TOCTOU | Membership or owner consent revoked after preflight but before write | Recheck session, membership, expiry and revocation inside the same transaction as the protected mutation; lock decision version | DENY |
| Reviewer collusion | Owner approves their own Store or same account acts as reviewer | Separate reviewer identity/role, server-resolved and independently audited; reviewer distinct from every owner in the decision | DENY |
| Stale review snapshot | Reviewer sees authority/evidence/receipts from different versions | Consistent snapshot or immutable evidence version/hash; bind reviewer decision to exact version | DENY |
| Provider webhook spoof/replay | Forged webhook or repeated delivery selects arbitrary Store | Provider signature + timestamp + replay nonce; server installation registry; installation-to-Store authority | DENY |
| Secret/token leakage | JWT, service_role, provider token or PII reaches browser, logs, GitHub or n8n | Secret manager; least-privilege server-only credentials; redacted structured logs; no secrets in public artifacts | Revoke/rotate and DENY |
| CSRF / origin confusion | Browser sends a privileged request from an untrusted origin | Exact origin at trusted edge, anti-CSRF for cookie auth, SameSite/secure cookies, strict content type, no wildcard CORS | DENY |
| Rate abuse / enumeration | Brute force challenge or reveal owner existence | Per-session, per-IP and per-intent rate limits; generic public errors; bounded body/timeouts | DENY / throttle |
| Prompt injection / bot privilege escalation | Customer chat instructs sales bot to grant Store ownership or change Tenant | Owner authority endpoints are never exposed as sales-agent tools; customer text cannot invoke consent or reviewer actions | DENY |
| Misconfigured deployment | QA route accidentally published or connected to live credentials | Separate private deployment, explicit environment allowlist, independent release review, no automatic workflow promotion | Keep endpoint disabled |
| Provider ambiguity | Provider ACK is unknown and retry could duplicate an operation | Outbox idempotency and reconciliation; owner authority flow must not trigger sends | No-send; manual review |

## 4. Trust boundaries

1. **Untrusted customer/client:** Messenger, Zalo, Website Widget and browser request bodies. These never select Tenant/Store or create owner authority.
2. **Authenticated owner UI:** proves a current actor only after trusted server verification; authentication alone does not imply Store ownership.
3. **Private owner authority service:** trusted boundary that resolves membership, consumes challenges, appends consent/revocation events and writes audit evidence. Not deployed.
4. **Supabase Auth + Postgres:** identity/session and authoritative membership/Store records; currently no canonical `public.stores` or `public.store_memberships`.
5. **Independent reviewer:** separate privileged identity, not any owner under review.
6. **n8n and channel providers:** downstream execution/notification systems, never sources of owner identity or canonical Store authority.

## 5. Future API contract — NOT_APPROVED

The machine-readable contract is `qa/v172c-rpc-closure/v172c40f-owner-transition-api-NOT_APPROVED.json`.

| Route | Purpose | Client-controlled input | Server requirement | Current status |
|---|---|---|---|---|
| `GET /private/v1/owner-decisions/current` | Redacted current decision | None | Current owner session; no private IDs in response | DISABLED |
| `POST /private/v1/owner-decisions/transition-intents` | Propose S1/S2 as a new version referencing S3 | Previous decision ref, requested S1/S2, idempotency key | Resolve actor, current session, membership and candidate boundaries server-side | DISABLED |
| `POST /private/v1/owner-decisions/owner-challenges` | Issue per-owner, per-Store challenge | Intent ref, idempotency key | Server binds session, Tenant, Store, version, operation, nonce digest and expiry | DISABLED |
| `POST /private/v1/owner-decisions/owner-consents` | Accept/decline explicit consent | Challenge, action, idempotency key | Verify session + membership + revocation; atomically consume challenge and append event | DISABLED |
| `POST /private/v1/owner-decisions/reviews` | Independent security review | Intent ref, evidence ref, review decision, idempotency key | Independent reviewer session, not an owner; immutable evidence snapshot | DISABLED |
| `POST /private/v1/owner-decisions/revocations` | Revoke consent | Consent event ref, reason code, idempotency key | Authorized owner/reviewer; append revocation and deny future admissions | DISABLED |

There is deliberately **no activation, Store-grant, migration, Order-writer or provider-dispatch endpoint** in this contract. A future review approval is not authority activation. A separate release design and approval would be required.

### Request and response invariants

- Identity, role, Tenant, Store, provider installation and permissions are resolved by the server; they are forbidden client fields.
- All mutation requests require idempotency keys scoped to actor + operation + decision version. Same key/same payload returns the original redacted result; same key/different payload is DENY.
- Challenges are opaque, random, short-lived, single-use and stored only as a digest. They are bound to a current verified session and exact intended operation.
- Challenge consumption and consent event append are atomic. Any DB/provider/auth uncertainty is DENY and requires a fresh review.
- Consent, review and revocation are append-only events. Do not edit the old S3 record or overwrite history.
- S3 remains active until a future separately approved private flow creates a new decision version. No automatic promotion based on synthetic test flags.
- Responses reveal only generic status and opaque references; never expose JWT, session ID, owner contact, private receipts or provider secrets.

## 6. Data model requirements — design only, no SQL

Future private schema (names are illustrative; do not create in V40F):
- `owner_decision_versions`: append-only decision ref/version/previous ref/status/decision hash.
- `owner_transition_intents`: requested S1/S2, initiator ref, state, idempotency key, expiry.
- `owner_challenges`: challenge digest, actor/session digest, Tenant/Store scope, decision version, operation, expiry, consumed timestamp; unique single-use constraint.
- `owner_consent_events`: immutable accept/decline event, owner/Store scope, challenge ref, signature/evidence digest, event time and revocation link.
- `owner_review_events`: reviewer identity ref, independent role proof, evidence snapshot hash, decision and time.
- `owner_revocation_events`: append-only revocation reason, actor, time and affected evidence ref.
- `alias_crosswalk_versions`: namespace-qualified alias, canonical Tenant/Store, source revision, evidence digest, validity/revocation and reviewer refs.

Use composite foreign keys to enforce Tenant↔Store consistency and unique active alias targets. Exposed tables must have RLS. Prefer SECURITY INVOKER; any narrowly justified SECURITY DEFINER helper must be private-schema, fixed search_path, schema-qualified, minimal EXECUTE grants and independently reviewed. Updates require both USING and WITH CHECK. Do not rely on a JWT role claim alone.

## 7. Release gates

All remain false in the V40F contract:
- Private service implementation and externally verified HTTPS/edge deployment.
- Actual Supabase Auth adapter and active session/revocation reader.
- Persistent single-use challenge/consent event store and atomicity proof.
- Independent reviewer identity and evidence-access audit.
- Security review, cost approval, backup/restore and rollback.
- Real independent owner A/B consent and authenticated read-only UAT.
- Canonical Store schema/RLS migration.
- Commerce writer, provider dispatch and production release.

No development branch or extra compute may be created until the authorized organization owner reviews actual pricing/limits, backup/restore and explicitly approves the cost.

## 8. Status and next checkpoint

- **VERIFIED:** V17.2C.21 and V17.2C.24 source candidates and their documented limitations; V40E S3 lock and 22/22 synthetic tests.
- **IMPLEMENTED:** V40F machine-readable API contract, all routes disabled, no activation endpoint.
- **PROPOSED:** private owner authority service threat model, API and data model.
- **BLOCKED:** deployment, real Auth/session adapters, private challenge persistence, signed owner evidence, reviewer and real A/B.
- **NO-GO:** Supabase DDL/RLS, Store grants, Orders access, n8n Published changes, provider sends, production.

Next candidate: **V17.2C.40G — Owner Authority Adapter Contract Tests × Atomic Challenge/Consent Transaction Model × Revocation Race QA**. Keep it synthetic/ephemeral and no-send until separately approved. No live branch or hosted route.
