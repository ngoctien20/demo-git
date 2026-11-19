# V18.3.6P — Auth/Store Transaction Attestation QA

**Evidence must not be conflated.**

1. **M PostgreSQL 17.12 disposable baseline:** GitHub Actions #44505388890, 53/53 pgTAP and 4/4 separate connection races against synthetic qa_m_auth.sessions and same-Tenant Store A/B. Real PostgreSQL row-lock behavior is observed, but GoTrue itself not tested.
2. **P PostgreSQL 17.12 disposable regression:** Replays M's schema and all 53 pgTAP assertions, then runs 17 additional SQL assertions after M's session A DELETE and membership revision, ensuring Store B still allowed, Store A deleted-session denied, B→A resource denied, nonce consumed once, rejected attempts not consumed and role direct-table access denied. CI container is --network none and destroyed after use.
3. **P offline cryptographic proof:** Ed25519-signs a *synthetic fixture receipt* with exact transaction ID, nonce, session/subject/Tenant/Store/resource hashes, Store revision and ordered events: SESSION_AUTHORITY_CHECK, SESSION_ROW_LOCK, STORE_MEMBERSHIP_LOCK, CATALOG_RESOURCE_LOCK, NONCE_CONSUME, TRANSACTION_COMMIT. Verification rejects wrong signature, role, Store, missing lock or nonce, wrong transaction ID, rollback, replay or contradictory outcomes.

**Important:** A valid ephemeral Ed25519 signature proves integrity of fixture bytes only. It does NOT prove actual PostgreSQL COMMIT, GoTrue session status, real authenticated owner A/B, durable production nonce, SQL body security or production signing-key custody.

## Required future genuine attestation

A private, independently reviewed transaction must verify a live Auth session (with actual signOut/expiry policy), signed subject and session binding, canonical Store membership and revision, exact authorized resource and nonce within the same transaction, then provide a trustworthy commit outcome and redacted versioned evidence. The privileged SQL function, algorithm, actual caller and key rotation must be reviewed. Never use arbitrary user-provided Store ID or generic service_role SQL proxy.

A remote Auth session check immediately before separate SQL is **not** proof of atomic revocation. Real GoTrue UAT and a human reviewer are still mandatory.

**Decision:** P DISPOSABLE TRANSACTION QA TESTED only once CI succeeds; REAL_AUTH_TRANSACTION_ATTESTATION=BLOCKED; PRODUCTION_RELEASE=NO-GO.
