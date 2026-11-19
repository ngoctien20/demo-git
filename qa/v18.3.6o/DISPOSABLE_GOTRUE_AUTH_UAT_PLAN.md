# V18.3.6O — Disposable GoTrue Auth UAT Plan

**Status:** PLAN_ONLY / NO_AUTH_SERVICE_STARTED / NO_SIGNOUT_RUN  
**Owner authorization:** NOT GIVEN for runtime creation, credential handling or real Auth sessions.  
**Isolation target:** NEW disposable Supabase local stack (GoTrue/Auth + PostgreSQL), **never** staging project ifxlvrhyjhbzbrkdsida or customer Auth.

## Setup admission (not performed)

1. Operator and independent reviewer explicitly approve a contained local test environment and any cost/resource footprint.
2. Discover and pin supported Supabase CLI version, container images (including GoTrue), PostgreSQL and cryptographic package digests via official documentation. Do not assume current scripts work on arbitrary versions.
3. Provision a fresh throwaway project namespace, ephemeral volumes, **no public listener or outbound provider/email/SMS traffic**. Required intra-container traffic should work, while external egress remains blocked.
4. Create only synthetic users A (two test sessions), B (unrelated user), one synthetic Tenant with Store A/B and a separate control Tenant. Never clone real users, JWTs or customer data. Exclude ephemeral credentials from git, CI and ChatGPT logs.
5. Confirm local Auth and PostgreSQL share a transactionally addressable database and verify restricted session-row locking permissions. No generic service-role SQL proxy or direct anon/authenticated session SELECT.
6. Preserve local baseline and redacted evidence plan; verify teardown before running.

## 20 required GoTrue UAT scenarios

| ID | Required observation |
|---|---|
| GT01 | local signout ends current synthetic session only |
| GT02 | global signout ends all same-user sessions; unaffected user B |
| GT03 | others ends same-user sessions except current |
| GT04 | JWT may remain cryptographically valid after signout; protected read denied |
| GT05 | Auth DELETE commits before protected read: DENY, no JTI consumed |
| GT06 | Protected read obtains row lock first; signout waits; later read denied |
| GT07 | session_id row exists but JWT subject/user mismatch denied |
| GT08 | Timebox expiry: deny even before row cleanup |
| GT09 | Inactivity expiry: deny even if row remains |
| GT10 | Single-session policy with another device |
| GT11 | Password change, user disable, security-sensitive termination |
| GT12 | Refresh-token rotation and reuse detection |
| GT13 | Auth outage/timeout: fail closed, no stale cache |
| GT14 | PostgreSQL lock timeout/deadlock: fail closed, no nonce |
| GT15 | Store membership revoked with active Auth session: deny |
| GT16 | Same JTI used across gateway workers: at most once |
| GT17 | Same-Tenant Store A/B owner cross-read denied |
| GT18 | GoTrue/Postgres restart: no resurrected privileges |
| GT19 | Ambiguous signout network ACK: recheck, never assume active |
| GT20 | Destroy disposable identities, volumes, secrets and test configuration |

**Current evidence:** All 20 are NOT_COLLECTED, no actual GoTrue UAT pass claim. A future evidence pack needs private redacted transaction timestamps, version digests, output/status, reviewers and validated teardown.

## Explicit gates

- Before running: approve resources and scope, private independent reviewer, versions pinned, no real creds, no external egress, teardown plan.
- The module gotrue-disposable-plan.mjs validates **metadata shape only**; even all-green simulated flags return authorizedToStart=false.
- Stop immediately on unexpected external send, unknown image digest, leaked token, use of real account, unexpected Auth session state or cost outside approval.
- Rollback deletes **only disposable local** volumes and synthetic accounts; no staging modification.
- Actual resource creation/Auth signout UAT requires a **separate explicit owner approval**. This Draft PR is not an approval.

Official references:
- https://supabase.com/docs/guides/local-development/cli/getting-started
- https://supabase.com/docs/guides/auth/sessions
- https://supabase.com/docs/guides/auth/signout
- https://supabase.com/docs/guides/auth/jwts

**Decision:** DISPOSABLE_GOTRUE_UAT=PROPOSED; REAL_AUTH_DELETE_LOCK_TEST=BLOCKED; PRODUCTION_SESSION_AUTHORITY=NO-GO.
