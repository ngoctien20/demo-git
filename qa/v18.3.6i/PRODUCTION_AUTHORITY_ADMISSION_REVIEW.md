# V18.3.6I — Production Authority Admission Review

**Scope:** review proposal only, not an approval or deployment authorization. **P0 blockers remain open.**

## Admission truth table

| Gate | Required real evidence | Current decision |
|---|---|---|
| Signed authority issuer custody | Environment-specific pinned Ed25519 keys in protected KMS/secret service, rotation and audit | BLOCKED — ephemeral CI keys |
| Real Supabase Auth | Verified signature, issuer, audience, Auth user, authoritative active session and real revocation semantics | BLOCKED — mock callbacks |
| Canonical Store authority | `public.stores` and `store_memberships`, 6 scoped columns, restrictive RLS and validated composite FKs | BLOCKED — absent on staging |
| Same-Tenant Owner A/B | Two distinct real owners, independent active Store memberships, private session and consent proof | BLOCKED |
| Durable signed nonce | Protected issuer-to-PostgreSQL transport, signed claim binding, atomic nonce and session/member check, restart and outage QA | CANDIDATE disposable only |
| Service role / privilege | Independent review of actual privileged SQL owner, grants, Data API exposure, abuse path, P0 closure | BLOCKED |
| Concurrent Auth revocation | Demonstrate real Auth service-to-DB revocation synchronization; forbid stale sessions | BLOCKED |
| Real Commerce read or write | Same-transaction authority check, price/stock/Order invariants, outbox and rollback | NOT IMPLEMENTED |
| Independent human review | Human reviewer different from implementer, signed current SHA/scope/expiry and approved remediation | BLOCKED |
| Backup, rollback, staging DDL | PITR restore evidence and explicit release owner approval | BLOCKED |
| Provider grants / media consent | Meta/Zalo/Website installation rights and owner media consent | BLOCKED |

## P0 findings carried forward from V18.3.6G

- P0: Untrusted/synthetic Auth identity is not a real Supabase verified session.
- P0: A privileged executor can bypass RLS if given generic table access.
- P0: Synthetic Boolean consent or signed fixture must not count as real merchant permission or provider grant.
- P0: No live canonical Store authority exists in staging.
- P0: No independent real reviewer has approved the security architecture.

## New findings from V18.3.6I

- **P0:** The protected I JavaScript callback and PG17 SQL function are separate test components. SQL cannot tell whether its input hashes were supplied by a truly Ed25519-verified issuer. A privileged forged caller can pass valid digest shapes. No live binding exists.
- **P0:** Local PostgreSQL session locks cannot atomically lock Supabase Auth's external session lifecycle. Real revocation synchronization and a protected source of truth must be separately tested before sensitive operations.
- **P1:** A nonce claim accepted in one transaction does not authorize a later data operation. Commerce data read/write requires same-transaction verification or an equivalent independently audited design.
- **P1:** Signing key rotation, digest secret rotation, nonce retention, HA/PITR and separation of security reviewers are unimplemented.
- **P1:** The synthetic issuer uses test-only Supabase issuer domain `.invalid`; deploying it as a live project issuer is prohibited.

## Reviewer disposition

`AUTOMATED_UNIT_AND_PG_QA`: eligible for TESTED if CI PASS.  
`INDEPENDENT_HUMAN_SECURITY_REVIEW`: BLOCKED.  
`REAL_AUTH_AB_ADMISSION`: BLOCKED.  
`STAGING_SCHEMA_MIGRATION`: NO-GO without separate approval.  
`COMMERCE_WRITER / PROVIDER_SEND / PRODUCTION_RELEASE`: NO-GO.

No production gateway route, Supabase migration, service-role credential, owner session or provider send is included in this PR. Closing this unmerged Draft PR is sufficient rollback.
