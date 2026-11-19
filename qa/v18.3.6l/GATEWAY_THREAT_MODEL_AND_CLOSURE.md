# TIEN404 AI — V18.3.6L ADR-03: Protected Gateway Threat Model

**State:** AUTOMATED ENGINEERING REVIEW / HUMAN INDEPENDENT REVIEW PENDING.  
**Trust boundary:** Browser/Meta/Zalo/Website → protected issuer/Auth → narrow RPC → Store-scoped PG transaction. The provider message, browser Store ID and n8n inputs are always untrusted.

## Trust and data-flow diagram

```text
UNTRUSTED browser / provider webhook / customer text
     |
     v
Protected ingress verifies origin, audience, installation, session
     |
     v
Dedicated issuer: Auth JWT + real authoritative session + Store membership
     |
     v
Short-lived signed Store/capability/resource receipt (key custody)
     |
     v
Protected gateway validates exact receipt, one-time JTI, rate/TTL
     |
     v
Private scoped RPC; same-transaction session authority + membership + resource
     |
     v
Approved read-only response / denied. No generic SQL, order writer or send.
```

**Current fact:** The K implementation is offline QA in a disposable PostgreSQL 17.12 DB, with synthetic Auth and a public fixture HMAC key. NONE of the trust edges above have been admitted as live production proofs.

## Mandatory threat register

| ID | Severity | Attack / failure | Required evidence to close | Status |
|---|---|---|---|---|
| L-P0-01 | P0 | Auth revoked between remote check and DB commit | Real authoritative `auth.sessions`/transaction behavior, delete/update race proof, failure/outage negative cases | **OPEN** |
| L-P0-02 | P0 | Store A/B same Tenant owner absent; malicious Store ID | Canonical Store mapping, real Owner A/B consent and same-Tenant negative RLS tests | **OPEN** |
| L-P0-03 | P0 | SECDEF/service-role can bypass RLS or accept forged claims | Complete PG grant inventory, private identity, exact operation/resource scope, cross-store forged caller negatives | **OPEN** |
| L-P0-04 | P0 | K public fixture HMAC can forge production RPC | Reviewed key custody + tested rotation + never shipping QA keys | **OPEN** |
| L-P0-05 | P0 | Self-review mistaken as independent security signoff | Distinct human reviewer attestation with code SHA, approved scope/expiry and evidence digest | **OPEN** |
| L-P0-06 | P0 | Provider/owner consent or installation spoofing | Private merchant rights proof, signed provider installation, media rights and sender auth | **OPEN** |
| L-P1-01 | P1 | Replay ledger retention, outage, PITR/restore inconsistency | Durable nonce recovery/cleanup tests, rollback and backup restore | OPEN |
| L-P1-02 | P1 | Old public, I/J or function grant bypasses new K gateway | Full functions/default privilege/PostgREST exposed schema enumeration and negative CALL tests | OPEN |
| L-P1-03 | P1 | Admission and later sensitive operation separated | Real data read/write in same approved transaction, stock/price/outbox atomic QA | OPEN |

## Specific abuse cases to model

- Wrong `kid`, unsigned JWT, `alg=none`, confused issuer/audience, Supabase JWT used as TIEN404 authority.
- Valid signature plus revoked `session_id`, user mismatch, disabled user, revoked Store membership, subscription expiry.
- Race with Auth signout before/after commit; disabled Auth API; conflicting event/epoch.
- Forged Store/tenant, stale role revision, cross-Store A→B and B→A.
- Direct callable `SECURITY DEFINER`, EXECUTE to PUBLIC/anon/authenticated, generic service-role API and SQL injection.
- Compromised shared HMAC secret, unpinned JWKS, poisoned key registry, key rotation overlap/rollback.
- Replay, distributed nonce duplicate, network-ambiguous ACK, retries after negative.
- Provider webhook spoofing, prompt injection through customer text, unauthorized send, leaking customer PII/tokens/logs.
- Real owner proof confusion (two Stores in **different Tenants** are not same-Tenant A/B evidence).

## Closure governance

`gateway-threat-gate.mjs` is a machine-checkable **evidence index**, not a security reviewer. Its completed-hash result is `EVIDENCE_INDEX_READY_FOR_INDEPENDENT_REVIEW`, while `verifiedThreatClosures=0` and `productionAdmitted=false`. Only a separate authorized human reviewer can assess underlying, privately retained evidence. The reviewer must differ from implementer and include code SHA, expiry, configuration/DB proof, incident response and rollback.

Priority: close P0-01 session authority, P0-03 privileged caller and P0-04 key custody **before** requesting any private real owner A/B test; P0-02 canonical Store schema requires separate migration authorization. No automatic migration or production publish.

**Verdict:** `P0_OPEN=6`, `P1_OPEN=3`. **LIVE READ/WRITE/PROVIDER SEND = NO-GO.**
