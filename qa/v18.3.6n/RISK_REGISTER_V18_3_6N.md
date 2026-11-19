# V18.3.6N — Gate/Threat Delta Against V18.3.6M

**All previous L six P0 / three P1 remain OPEN.** N is a contract/evidence-governance stage; no fix to the live system occurred.

| ID | Severity | Issue and present proof | Status | Owner gate |
|---|---|---|---|---|
| N-P0-01 | P0 | Four public SECURITY DEFINER functions; effective EXECUTE counts 1 anon, 2 authenticated, 1 service_role. Function logic, PostgREST exposure and exploitability **unknown** | OPEN REVIEW; not confirmed exploit | Owner approves private body review + independent second reviewer |
| N-P0-02 | P0 | Synthetic Auth DELETE locked in PG17, but real Supabase GoTrue signOut scopes/timebox/inactivity/refresh and row DELETE ordering unverified | OPEN | Separate isolated real Auth UAT approval |
| N-P0-03 | P0 | Production private RPC caller crypto, key custody, SQL verification and service-role bypass cannot be asserted from synthetic HMAC | OPEN | Architecture approval + key/KMS review |
| N-P0-04 | P0 | Real Canonical Store RLS same-Tenant Owner A/B missing | OPEN | Staging migration planning and private Auth A/B approval |
| N-P0-05 | P0 | No independent human reviewer attestation for functions, Auth and crypto | OPEN | Named independent reviewer and SHA-bound signed decision |
| N-P0-06 | P0 | Merchant/provider rights and customer data access remain unverified | OPEN | Platform/provider grants + merchant consent |
| N-P1-01 | P1 | Session row expiry, active-user state and policy version not reducible to row existence | OPEN | Real Auth session semantics matrix |
| N-P1-02 | P1 | PostgREST exposed schemas, default grants/ACL/ownership snapshot not enumerated | OPEN | Authorized private metadata plus body review |
| N-P1-03 | P1 | Ledger HA/PITR/retention, backups, real Commerce transaction downstream not proved | OPEN | Recovery and writer contract QA |

**No production access, no DDL, no grant changes, no key, no provider send.** Even all-green synthetic gate metadata remains **not an owner/reviewer signed approval**.

**Next safe gate:** User can explicitly authorize *only* a bounded, redacted staging function-body inspection with independent reviewer and checkpoint if they want. Alternatively continue fully offline by building a disposable GoTrue-compatible Auth UAT harness, after verifying cost and environment isolation. Do not move to real owner A/B or production without separate consent.
