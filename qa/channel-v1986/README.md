# TIEN404 V19.8.6 — Bot Installation → Owner → Tenant → Store Authority

**Status: CANDIDATE / SYNTHETIC + EPHEMERAL POSTGRESQL UAT ONLY. No live grant, send or Commerce read.**

## Actual read-only audit findings (19 Nov 2026 JST)
- Real Zalo QA inbound workflow `jy7vCmt8LH6BSqGh` is Active; Webhook Header Auth credential is `TIEN404_ZALO_QA_INBOUND_V18_1`; the workflow emits a no-PII receipt marker only. Its normalized event output explicitly has `storeAuthorized=false`, `ownerRoleGranted=false`, `botIdentityBound=false`.
- A successful Header Auth proves the ingress accepted one configured shared Secret. **It does not independently prove the provider Bot ID, owning merchant, Store authorization or a signed owner session.**
- Staging `tien404_r1_qa.shop_bots` contains two entries, both `synthetic_qa` and `dry_run`.
- Existing `tien404_v175_qa.channel_identity` models provider user identity, not verified merchant Bot installation ownership; `app_private.channel_secrets` is a secret-reference structure, not a canonical Store ownership proof.
- Public Commerce Products and tenant/channel agent configs lack canonical Store scope. Existing n8n Commerce catalog path is tenant-wide and not a protected Bot-specific Store reader.

## Added candidate implementation
- `installation-authority.mjs`: pure offline evaluator. Strict input allowlists and deny-by-default behavior. Requires *mock* independent transport evidence, a unique endpoint-bound Bot Installation, matching credential/epoch, the owner/Store/tenant identity and consent, registration version, and a simulated durable unique-event gate.
- `installation-authority.test.mjs`: 82 synthetic tests, including duplicate Bot or endpoint, compromised/stale credential reference, owner consent revoked, manager pretending owner, Store migration without transfer approval, same-tenant Store A/B and forged client claims.
- `ephemeral-installation-schema.sql`: a **disposable PostgreSQL 17** schema `qa1986` with Bot installation/owner-consent tables, Store+owner composite FKs, private `SECURITY INVOKER` read helper, restrictive role grants and RLS.
- `ephemeral-installation-acceptance.sql`: SQL assertions for private verifier role, authentication/anonymous denial, credential epoch, Store A/B separation, consent revocation, tenant and Store membership revocation, version-change re-consent, duplicate identity and FK errors.
- `.github/workflows/tien404-v1986-bot-installation-qa.yml`: GitHub Actions runs only Node 22 and local disposable PostgreSQL 17. No hosted credentials, Supabase access or Zalo sends.

## Strict trust boundary
The fixture strings `MOCK_AUTHENTICATED_ENDPOINT`, `MOCK_SERVER_VERIFIED_OWNER`, `MOCK_AUTH_SESSION`, `MOCK_DURABLE_UNIQUE` and `MOCK_CANONICAL_STORE_AUTHORITY` are **test labels**. They do not certify cryptographic signature validity, Zalo provider attestation, OAuth, merchant owner identity, immutable installation mapping, actual durable event inbox, Supabase Auth or API grant.

Do **not** use any mocked flags from this module to authorize live data reads. The successful candidate returns `OFFLINE_BINDING_CANDIDATE`, *never* a real tenant/store scope, API credential, provider reply or privileged access. Even positive outcomes always return `canReadHosted=false`, `canSend=false`, `canWrite=false`, `productionReady=false`.

## Required actual private admission design (PROPOSED)
1. **Provider ingress**: preserve the dedicated Zalo Bot webhook, verify the provider's documented authentication method and bind the verified endpoint or credential to exactly one server-registered installation. Do not assume sender identity or the body is a trusted Bot identifier.
2. **Installation registry**: a protected, server-owned record with installation ID, unique channel=`zalo_bot`, verified external Bot ID, endpoint/credential references (no raw secrets), tenant ID, store ID, owner ID, lifecycle, version, installed/verified timestamp, revocation and audit metadata. Zalo OA is a separate channel type.
3. **Owner authority**: a real Supabase Auth owner session (not customer message/owner Bot ID), active tenant membership and explicit Store-owner membership. Installation approval must be separately recorded per Store and registration version, with an approved transfer policy.
4. **Read admission**: only internal trusted service behind least privileges can map provider installation→Store. Use verified Store-scoped RLS and actual catalog source; deny missing, duplicated, revoked, expired or conflicting bindings.
5. **Replay controls**: persistent, installation-scoped idempotency key with transaction semantics, bounded receipt/body timeout, rate limit, Bot echo rejection, no raw personal identifiers in QA reporting.
6. **Output**: keep no-send preview while live store ownership is pending. A later Zalo reply requires explicit separate user approval; order creation, stock mutation, billing and revenue notifications require further approvals.

## Hard blockers / non-goals
- No real registered Zalo Bot provider identity proof beyond a shared webhook secret has been verified.
- No verified real Owner A/B signed Supabase sessions in a same-tenant two-Store hosted environment.
- No production-ready Store schema migration or protected Catalog Reader.
- No API credentials or real provider/owner identity captured in this PR. Do not paste Bot Token, webhook Secret, session JWT, personal IDs or customer conversations into GitHub or chat.

## QA evidence and rollback
- Run locally: `node qa/channel-v1986/installation-authority.test.mjs`.
- Run disposable PostgreSQL: first `qa/channel-v1983/ephemeral-postgres-schema.sql`, then the V19.8.6 schema and acceptance files.
- GitHub Actions final run status must be verified separately; do not infer success simply from files committed.
- Rollback: close Draft PR #459 or revert this independent QA directory/CI. GitHub Actions disposes the PostgreSQL service; no hosted schema, n8n Published workflow, Bot secret or live customer data has been changed.

Checkpoint: `TIEN404-V19.8.6-INSTALLATION-OWNER-STORE-AUTHORITY-CANDIDATE-NO-LIVE`.