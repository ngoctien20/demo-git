# TIEN404 V19.8.15 — Isolated registry PostgreSQL × Real local Owner A/B × Protected read

**Status:** CANDIDATE, not hosted admission, no live Zalo proof. Extends V19.8.14 #467 and V19.8.12 #459.

## Purpose
The new isolated local PostgreSQL 17 fixture adds a private registry + attestations and a strictly bounded *test-only* protected catalog read RPC. The runtime runner signs up **fresh real local Supabase Auth users**, verifies JWTs with GoTrue, consumes the previous V19.8.12 server-side nonce challenges, and queries via actual local PostgREST. Two stores share one Tenant and the same SKU but prices differ (Store A 159000 VND; Store B 189000 VND).

## Execution
GitHub Actions `tien404-v19815-local-registry-uat.yml` provisions its own Docker Supabase CLI stack; never connect a hosted project or import hosted tokens. Dependencies are applied in order: V19.8.9 six-table QA fixture, V19.8.10 installation fixture, V19.8.12 challenge fixture, then V19.8.15 private registry. Execute `node ../channel-v19815/local-real-owner-registry-uat.mjs` from `qa/channel-v1989` with `T404_V19815_DOCKER_ONLY=TRUE_EPHEMERAL`.

## Safety and scope
The private registry only stores SHA-256 **synthetic identifiers**; a real deployment requires a salted/HMAC key digest and independently signed provider evidence. Test booleans are deliberately fake. The `public.t404_v19815_protected_catalog` SQL SECURITY DEFINER RPC is a *local disposable test function*, and absolutely not a reviewed production authorization design. In hosted, use a narrowed owner role, locked-down schema privileges, current Store authority with RLS, and independent security review before privilege changes. Its RPC cannot write catalog and never grants provider sends.

Positive controls: real Auth JWT A→A; B→B; one-time challenge consumption. Negative controls: pending consent, challenge replay, A→B/B→A, same-tenant no-store member, anonymous, private Data API visibility, order/product write attempt, expired attestation, false webhook secret match, credential epoch drift, stale version, revoked membership under still-valid JWT, revoked installation and invalid JWT.

**Important:** This verifies authorization *through the protected RPC only*. Older test fixtures may have their own independently authorized product endpoints; passing this test does not establish that every existing production catalog endpoint is installation-gated.

## No-Go and next gates
The current hosted Supabase schema lacks verified canonical Store isolation. Real official Zalo `getMe`, `getWebhookInfo`, actual header secret correspondence, trusted signer and hosted owner authenticated challenge are still missing. Never confuse `real local Auth JWT` with `real merchant owner in hosted`.

No provider sends, no order writes, no hosted schema changes, no customer PII, no credential rotation, and no production deploy. Rollback: close this draft PR or revert only V19.8.15 new paths. Final status **NO-GO** for hosted and production until independent backup/restore provenance, issuer/operator proof, trusted registry, canonical Store authority, and signed hosted UAT are accepted.
