# V18.3.6I — Session / Membership Revocation Race Truth Table

**Environment:** disposable PostgreSQL 17.12, two independent `psql` connections, synthetic sessions + Store memberships; **no real Supabase Auth**.

| Ordering | Expected result | Evidence |
|---|---|---|
| Revocation transaction gets session row lock; marks inactive; commits before admission | `DENY_SESSION`, no JTI consumed | CI two-session case |
| Membership revocation gets membership row lock first; commits | `DENY_MEMBERSHIP`, no JTI consumed | CI two-session case |
| Two simultaneous admissions with same signed JTI | Exactly one `ACCEPTED`, one `REPLAY` | Unique `(issuer,jti)` and concurrent CI |
| Admission obtains locks and consumes JTI before revocation | Initial admission `ACCEPTED`; later distinct JTI denied when revocation commits | Admission-first CI |
| Revoked session before ordinary PG call | `DENY_SESSION` | pgTAP |
| Revoked membership before ordinary PG call | `DENY_MEMBERSHIP` | pgTAP |
| Membership revision changed after token issuance | `DENY_MEMBERSHIP` | pgTAP |
| Wrong Store/subject/session/tenant/capability | DENY, no nonce burn | pgTAP |
| PostgreSQL restarted after nonce acceptance | `REPLAY` persists | CI restart case |
| Actual Auth service revokes remotely but local registry has not updated | **UNPROVEN / CAN BE STALE** | Admission BLOCKED |

### PostgreSQL locking semantics

The privileged nonce function runs under a single transaction and obtains locks in this order: session row, then Store membership row, then UNIQUE nonce INSERT. Revocation updates the same synthetic rows and must wait if they are locked. Testing uses `READ COMMITTED`, ensuring a waiting lock sees updated committed row state. Transactions which started the operation first may legitimately complete before revocation. See PostgreSQL 17 explicit row locking documentation.

These tests do **not** prove Supabase Auth revocation propagation, authorization across multiple services, cross-region consistency, or safe Commerce operations performed later in another transaction.

### Contention and safe fallback

If session/member row missing or inconsistent, DENY. If PostgreSQL unavailable, DENY. If nonce already used, REPLAY. On ambiguous success/network acknowledgment, do not blindly retry another JTI for the same operation. Production must define receipt idempotency, operator-visible reconciliation and durable audit before allowing sensitive actions.
