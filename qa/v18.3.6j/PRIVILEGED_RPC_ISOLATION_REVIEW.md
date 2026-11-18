# V18.3.6J — Privileged RPC Isolation & Same-Transaction Review

## Exact boundary
`qa_i_private.transaction_bound_catalog_read` is a private `SECURITY DEFINER` SQL function, owned by `tien404_i_owner` (NOLOGIN, NOBYPASSRLS), with `search_path=''` and all objects fully schema-qualified. It is granted only to `tien404_j_gateway` (NOLOGIN), with no direct catalog/session/membership/nonce table privileges. `tien404_j_attacker` has neither USAGE nor EXECUTE.

The catalog fixture is Store-scoped by exact `(tenant_hash,store_hash,resource_id)`. The function first holds `FOR KEY SHARE` on the synthetic resource and checks local-session freshness; it then invokes I's atomic protected nonce routine **in that same SQL statement/transaction**. That routine locks session row followed by Store membership row (`FOR UPDATE`) and consumes JTI on the unique ledger. Only after successful admission does J return the selected, synthetic, non-PII catalog item and price.

## Privilege hazards that remain

1. SECURITY DEFINER functions usually run with the owner's privileges; PostgreSQL table owners bypass RLS unless FORCE RLS. RLS on the catalog table is defense-in-depth, **not the primary authority barrier** of this privileged code.
2. The SQL function accepts client/caller-provided digests. It does **not** cryptographically check Ed25519. An actor who acquires the gateway EXECUTE capability can supply correct-looking hashes, use an unspent JTI and read data if local session/membership rows match. This is a P0 risk, not a solved cryptographic trust boundary.
3. The predecessor I nonce-only function remains executable by a separate I executor role in the disposable schema. Production would need a complete inventory and revocation of old broad grants, verified against PostgREST exposed schemas and all SECURITY DEFINER functions.
4. The authentication source is a synthetic session mirror, not a live, independently validated Supabase Auth session.
5. No rate limiting, production issuer key custody, durable audit/redaction, anti-enumeration, operational alerting or HA guarantee is established by these tests.
6. A read-only transaction is an improvement over separate "admit now, read later" calls, but does not secure further actions performed after it returns.

## Production design gate
The proposed final gateway should be accessible only through a protected private backend, with real JWT verification, exact Auth active-session check, Store authority mapping, issuer signature/key validation and DB transaction-bound query. Do NOT expose the SECDEF RPC through `public` PostgREST or grant EXECUTE to `anon`/`authenticated`; do NOT pass `service_role` to n8n or browser code. Independently audit all grants and default privileges, confirm safe behavior under revocation races and outage before release.

The documented Supabase lint warning `0029_authenticated_security_definer_function_executable` specifically flags SECURITY DEFINER callable by authenticated users. This candidate avoids that pattern in disposable PG, but the real deployment has not been reviewed.
Source: https://supabase.com/docs/guides/observability/advisors?queryGroups=lint&lint=0029_authenticated_security_definer_function_executable

**Decision:** Disposable isolation candidate only. Real privileged RPC and user/Store admission remain BLOCKED.
