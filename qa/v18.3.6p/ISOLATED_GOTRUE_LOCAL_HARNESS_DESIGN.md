# V18.3.6P — Isolated GoTrue Local Test Harness Design

**Classification:** NON-EXECUTING BLUEPRINT. No local Auth stack, Docker container, user, key or external network created.

## Objective

A real local GoTrue service must be exercised to establish behavior of Supabase signOut, refresh, session cleanup and transaction locking. Synthetic PostgreSQL fixtures prove PostgreSQL ordering but not actual Auth service DELETE semantics. The separate UAT is not approved in this phase.

## Planned environment controls

| Area | Requirement | P status |
|---|---|---|
| Project | New disposable local namespace, not existing Supabase staging | PLAN |
| Versions | Version-pinned Supabase CLI and digest-pinned GoTrue/PostgreSQL images | NOT PROVISIONED |
| Network | Loopback listeners, container-internal Auth–DB connections, external egress/SMTP/SMS/webhooks blocked | PLAN |
| Credentials | Ephemeral synthetic accounts, private local credential store, no bearer token logs | NOT CREATED |
| Data | Two sessions for synthetic user A, unrelated user B, same-Tenant Store A/B plus control Tenant | PLAN |
| Authority | Separate owner approval to create local resources and independent human reviewer | NOT RECEIVED |
| Database | Verified same PostgreSQL transactional domain and locked Auth row semantics | NOT TESTED |
| Cleanup | Temporary namespace/volumes only; teardown must preserve any unrelated containers | PLAN |

The isolated-gotrue-harness-plan.mjs code is **metadata-only**. Even if all test flags are set true, it returns authorizedToStart=false, containersStarted=0 and actualAuthCalls=0. The example version/digests in offline tests are deliberately synthetic, not runnable approved pins.

## Proposed post-approval workflow

1. Check official Supabase CLI local development documentation and discover current CLI help/version, select an approved binary and immutable image digests, pre-cache images before blocking external egress.
2. Confirm the new isolated workspace does not share Docker volumes, Auth user database, credentials, ports or frontend config with staging.
3. After owner/operator and reviewer authorization, launch disposable local Supabase Auth + Postgres with test-only users and same-Tenant Store fixture.
4. Run the 20 GoTrue UAT cases GT01–GT20 in O: local/global/others signOut, token surviving signOut, session deletion races, timebox, inactivity, refresh reuse, restart, cross-store, ambiguous ACK, replay and teardown.
5. Record only private redacted timestamps, test IDs, version digests, transaction ordering and PASS/FAIL; deny/stop on any external send, leak, unrecognized session or cost outside approved scope.
6. Destroy only newly created local resources and verify no credentials remain.

Official CLI reference: https://supabase.com/docs/guides/local-development/cli/getting-started

**Current outcome:** LOCAL_GOTRUE_HARNESS=DESIGNED / UAT_EXECUTED=false / RESOURCE_CREATION_AUTHORIZED=false / PRODUCTION_AUTH=NO-GO.
