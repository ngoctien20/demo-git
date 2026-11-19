# V18.3.6Q — Transaction-Bound RPC Proof/Caller Trust Closure (Disposable)

**Important wording:** Only the **negative QA contract** can close on disposable PostgreSQL 17. Production RPC trust remains OPEN. There is no managed production signing key, real GoTrue session authority or authorized Store registry.

## Architecture under test

Synthetic Node.js `rpc-proof-fixture.mjs` generates a versioned UTF-8, LF-delimited 13-field proof (schema Q1, issuer, audience, key ID, session/user/Tenant/Store, member revision, item, capability, JTI, epoch expiry). It calculates HMAC-SHA256 using a **COMMITTED, INTENTIONALLY PUBLIC FIXTURE KEY** (32 bytes ASCII 'Q'). Neither a real JWT nor Ed25519 production authority is used.

A narrow PostgreSQL role `tien404_q_rpc_caller NOLOGIN NOBYPASSRLS` has only EXECUTE on `qa_q_private.signed_catalog_read`, not SELECT/DELETE/INSERT on Auth/member/catalog/nonce/key tables. The private SQL wrapper validates HMAC, expiry and exact canonical fields, then invokes M's existing synthetic session/Store/nonce transaction in the **same PostgreSQL transaction**.

The fixture function owner `tien404_m_owner` has privileges to access underlying data and potentially bypass its RLS. This is **an intentional privileged simulation**, not least-privilege proof for production. A caller who acquires an RPC EXECUTE capability and knows the committed fixture key can forge proof, so the private caller identity and secret custody remain **OPEN P0**.

## QA matrix

| Test class | Expected negative/positive evidence |
|---|---|
| PostgreSQL ACL / grants | Only a named private role can execute wrapper; Q untrusted cannot. Neither role gets direct table/key access |
| Node ↔ PG17 HMAC parity | Valid exact Store B/item/revision/expiry proof succeeds; wrong MAC denied |
| Versioned claim tamper | Change Store/resource/user/session/revision/JTI/expiry without recomputing MAC → DENY_MAC |
| Well-signed but wrong authority | User/session mismatch → DENY_SESSION; Store wrong → DENY_MEMBERSHIP |
| Cross-Store resource | Signed resource from other Store → DENY_RESOURCE_SCOPE |
| Replay | Same JTI is consumed once by M's PostgreSQL nonce ledger; repeated signed call → REPLAY |
| Revoked/missing session | Deleted synthetic session A → DENY_SESSION; no nonce burned |
| TTL and malformed inputs | Expired/too-far/uppercase/nonhex MAC/null JTI → DENY |
| Failures and concurrency | Prior M standalone PostgreSQL two-connection races still evidenced, but GoTrue real logout not tested |
| Key and caller threat | PUBLIC fixture key and SECURITY DEFINER owner are explicitly marked NOT SAFE FOR PRODUCTION |

## Hard production blockers
- Real Supabase Auth signature, session policy/expiry, logout API semantics and transaction lock interaction NOT VERIFIED.
- Canonical Store registry, Owner A/B membership, tenant isolation and migration absent.
- Actual private key custody/KMS, safe SQL verifier or trusted dedicated database principal NOT APPROVED.
- Current public SECURITY DEFINER function bodies/alternate invoker routes unreviewed.
- SQL string/HMAC byte equality is not a vetted constant-time production signature-verification implementation.
- Any compromise of the private caller + shared key can bypass intended authorization; generic service_role SQL bridge forbidden.
- Human owner approval and independent security review remain missing.

**Verdict:** `DISPOSABLE_NODE_PG17_HMAC_PROOF_QA=TESTABLE`, `PRODUCTION_RPC_TRUST_CLOSED=false`, `AUTH/STORE_RELEASE=NO-GO`.
