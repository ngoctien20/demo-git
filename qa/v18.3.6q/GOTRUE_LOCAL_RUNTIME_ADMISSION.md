# TIEN404 V18.3.6Q — GoTrue Local Runtime Admission

**State:** PREFLIGHT DESIGN + OFFLINE NEGATIVE TESTS; no GoTrue containers, users, tokens or live signOut calls started. The preceding M/P tests run **PostgreSQL only**, with fake `qa_m_auth.sessions`, NOT actual GoTrue.

Official current Supabase guidance: https://supabase.com/docs/guides/local-development/cli/getting-started and https://supabase.com/docs/guides/auth/sessions. CLI supports `supabase init` and `supabase start` to launch local services, but actual command availability and container digests must be verified against a pinned supported CLI version.

## Admission before any runtime start

| Gate | Decision |
|---|---|
| Brand new disposable local project, never live staging | REQUIRED |
| CLI semver/image digest pinned, `--help` observed, compatible GoTrue/PostgreSQL | REQUIRED |
| Internal GoTrue ↔ Postgres networking, external egress/SMS/SMTP/webhook blocked | REQUIRED |
| Loopback only, no public callback/webhook listener | REQUIRED |
| Disposable synthetic owner A/B users and sessions, no real customer identities | REQUIRED |
| Ephemeral credentials private and redacted from CI logs | REQUIRED |
| Auth and Store inside the same PostgreSQL transactional domain | REQUIRED |
| Verified session row-lock privileges, failure mode, safe teardown | REQUIRED |
| Distinct owner approval for creating runtime resources + independent reviewer | **NOT RECEIVED** |

`gotrue-runtime-admission.mjs` validates only **submitted plan metadata**. Even if every input is marked true, it returns `PLAN_READY_FOR_INDEPENDENT_RUNTIME_APPROVAL`, with `localGoTrueStarted=false`, `mayStartRuntime=false`. These booleans cannot verify that Docker egress is actually blocked.

## Real UAT runbook AFTER authorization

1. Independently verify and pin supported Supabase CLI and GoTrue/PostgreSQL container digests; cache approved images and check licensing/costs.
2. Start a completely isolated local stack; verify no access to real Supabase project ref or existing volumes.
3. Create ephemeral QA-only users A (two sessions) and B, synthetic Store A/B under same Tenant. Disable outbound delivery and production credentials.
4. Run O's 20 GoTrue cases covering `signOut` global/local/others, JWT still valid after signout, real session delete/cleanup/timebox/inactivity, refresh rotation, two-connection DB races, cross-Store and nonce.
5. Record redacted test evidence with exact version and reviewer; fail closed on unverified session state, network timeouts and ambiguous ACK.
6. Teardown ONLY the newly created disposable namespace/volumes; independent check that no credentials or resources remain.

The current linked staging Supabase `auth.sessions` rows and function bodies were never read; a GoTrue runtime design cannot be represented as real Auth revocation proof.

**Gate:** GO_TRUE_REAL_UAT=BLOCKED / RESOURCE_APPROVAL_NOT_RECEIVED / PRODUCTION_NO-GO.
