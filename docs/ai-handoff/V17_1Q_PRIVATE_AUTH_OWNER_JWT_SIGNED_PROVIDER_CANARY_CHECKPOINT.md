# TIEN404 V17.1Q — Private Auth Owner UAT × Real JWT × Signed Page/OA Canary

Date: 2026-11-17 JST. Parent: V17.1P Draft PR #290 HEAD `73f1d10570ac9abd1eeaa59f3dad7b92f388a85a`.
Stage: **PRIVATE REAL ADMISSION BLOCKED**. The module is deploy-agnostic source; no hosted webhook, secret, read client, or customer send exists in this PR.

## Evidence rechecked in live connected systems (READ-ONLY)

- Supabase staging project `ifxlvrhyjhbzbrkdsida`: tenant_identity_map has 2 Stores across 2 different Tenants, and exactly 2 owner binding links. **0 same-Tenant Store A/B owner pairs**. Auth user count 3, session count 5 (2 users); 0 Tenants with two distinct users who both have session + active membership. No private JWT was extracted or verified by this audit.
- Legacy `public.products`, `public.orders`, `public.customers` still have tenant_id only; 0/3 direct Store-scoped RLS predicates. This **blocks real same-Tenant Store JWT UAT**, but does NOT prove an exploit.
- RPC `public.qa_shop_b_zalo_claim` is SECURITY DEFINER executable by anon; code/challenge/nonce/TTL require privileged private review before changing grants. No RPC invoked.
- Messenger TEST Published V17.17 `1064b1b3-d3f1-4a6b-a367-2414ba691522`, all FOUR original V17.15 nodes remain. Zalo Lab Published V17.19 `2d912cb0-007f-452f-9536-b92ba12a03e6`. Neither workflow modified or republished.
- Existing Zalo Protected Webhook node has credential metadata but lacks visible direct X-ZEvent-Signature verification and rawBody option; may have upstream validation. **Evidence gap, not confirmed bypass.**

## Newly IMPLEMENTED — strictly source-only cryptographic verifier

`qa/v171q-private-uat/private-admission.cjs` exports `createPrivateAdmissionGate()` and `nativeJwtVerify()`. Its host must inject trusted keys and independent private callbacks. It does not fetch keys, read tables, load credentials, listen on a port, call LLM, send a message, or create an order.

Separate admission paths:

1. **Private merchant owner:** cryptographically verify Supabase-issued RS256/ES256 JWT using explicitly supplied trusted JWKS, exact issuer/audience, role authenticated, UUID subject+session_id, iat/nbf/exp and max 1h token lifetime. Asynchronously verify *live session active* via trusted backend and *owner Store role+mapping* from server registry. Reject client-supplied Store/owner claims and editable user_metadata. Mint same-gate opaque owner receipt. A valid JWT without owner registry or active session is insufficient.
2. **Meta Messenger:** accept only raw Buffer, bounded single event, exact Page/destination/sender/mid, no echo and ±5min; map Page using trusted installation registry with independently verified owner binding; retrieve private App Secret; verify HMAC-SHA256 raw bytes against X-Hub-Signature-256 with timing-safe comparison; call **atomic durable replay reservation**. Never trust a `verified=true` payload field.
3. **Zalo OA:** validate documented `user_send_text` envelope, exact app_id/OA/destination, timestamp and message ID; retrieve separate OA secret from managed source; verify SHA256(appId + raw JSON data + timestamp + OAsecretKey) against native X-ZEvent-Signature in constant time. Zalo does NOT use Meta HMAC; no OA signature is treated as a Meta event.
4. **Binding:** both internally minted receipts from the *same verifier instance* must match Tenant and Store to produce **NO-SEND plan only**. Cross-Store owner→Page/OA is refused. No client can forge a receipt by making a similar object.
5. **Read plans:** signed provider may only construct a public catalog plan. Own-order-status requires an additional independently human-verified customer OrderAccessGrant tied to Store, channel, sender and order. The plans explicitly set dbExecuted=false/sendEnabled=false; actual reader must be separately installed, authorized, transaction-bound and RLS-tested.
6. **Sensitive fields:** Auth subject/session and provider customer sender/message ID are held in private WeakMap memory; issued receipts omit tokens, raw payload, sender/customer IDs and secrets. Production logs must not serialize internal JWT claims.

### Verified offline test evidence

- `private-admission.test.cjs` in Draft PR verifies RSA/ES256 signatures, Meta and Zalo native-shaped signatures with independent **TEST-ONLY** keys, replay/TTL, wrong owner/Store, malicious JWT header, wrong key, invalid signatures, trust boundaries, and NO-SEND. Real provider/real JWT evidence remains **false**.
- An additional portable locally executed full 84-case suite is provided to the owner in the conversation attachment. If the GitHub suite differs in number, report the two counts independently.
- **Synthetic crypto is real arithmetic but fake identity.** Do NOT infer any real Meta Page/OA or Supabase JWT owner authority from it.

## Real Private UAT admission — still BLOCKED

1. Obtain explicit owner/operator approval for two genuine independently enrolled QA users in DIFFERENT Stores under SAME Tenant. Owner identity and permission changes must be backed up, reviewed and authorized; do not reassign real customer data or grant broad SELECT.
2. Use protected private browser/client to sign in twice. Verify actual Auth JWT with Supabase Auth `getClaims()` or `getUser()` and fresh session_id. Never put JWTs/passwords/provider secrets into chat, GitHub, n8n execution records, QA tables or logs.
3. Least-privilege protected reader tests A→A, A→B, B→B, B→A with approved dummy Store records and actual signed identity. Validate Store Ownership, revocation, stale token, session expiry and OrderAccessGrant without service_role/SECURITY DEFINER bypass.
4. Privately authorize separate Meta QA Page/App and Zalo QA OA/App; manage signing secrets outside the repo. Receive real signed NO-SEND event in an isolated callback (not live webhook); verify exact raw payload, timestamp, Page/OA, installation, replay, owner proof, and produce PII-free independent receipt.
5. Independent QA reviewer attests JWT signer/key ID, genuine session, same-Tenant Store scopes, true Page/OA owner binding, byte-exact provider signature proof, RLS/reader denial, and zero sends/writes. Only then ask for a separate live deployment approval.

### Release gate and rollback

CI source tests can PASS, while real private UAT/hosted-release job must intentionally FAIL (NO-GO) until these independently verified receipts exist. Real production deployment is not authorized by this milestone.

Rollback: close the child Draft PR; no n8n Published workflow, Auth user/membership, Supabase schema, credential, provider Page/OA, order, stock, billing or customer message was modified. No live restoration required.

Official references:
- https://supabase.com/docs/reference/javascript/auth-getclaims
- https://supabase.com/docs/reference/javascript/auth-getuser
- https://supabase.com/docs/guides/auth/sessions
- https://developers.facebook.com/docs/graph-api/webhooks/getting-started/
- https://stc-developers.zdn.vn/docs/v2/official-account/webhook/tin-nhan/su-kien-nguoi-dung-gui-tin-nhan


## V17.1Q Independent CI acceptance and release gate (VERIFIED 2026-11-17 JST)

Tested code SHA: c2b4fa34fc8a1c1085d6c29d4fc708eca51f96b8.
GitHub Actions: https://github.com/ngoctien20/demo-git/actions/runs/44051494481

- Cryptographic source CI job 133930178638 SUCCESS: 66/66 new GitHub Node crypto QA cases and 855/855 inherited V17.1P through V17.1D cases, 921/921 combined tests PASS. Static checks confirm no external network, process.env, subprocess or credential/DB access and real acceptance manifest explicitly HOSTED_NO_GO.
- Independent disposable PostgreSQL 17 job 133930178356 SUCCESS: throwaway same-Tenant Store A/B temporary RLS, ROLLBACK, DISPOSABLE_SAME_TENANT_STORE_A_B_RLS_PASS, proof scope NO_REAL_JWT_NO_COMMERCE_TABLES.
- Real Meta/Zalo QA Page/OA + Supabase owner JWT release job 133930453684 FAILURE BY DESIGN: actual separate owner-approved same-Tenant Store A/B JWT pair, native managed-secret signed NO-SEND event and least-privilege Store RLS/OrderAccessGrant are absent. Overall GitHub run RED intentionally, NOT a source QA failure.
- An initial source CI at SHA 8a236acca70e113300520eae936eec7488a95e16 ran 66/66 crypto and PG17 successfully but stopped at metadata validator referencing an absent manifest field. The validator was corrected to assert the existing HOSTED_NO_GO field. Cryptography and permissions were not relaxed.
- A separately created downloadable portable ZIP contains an extended 84/84 locally passing crypto suite. It is distinct from GitHub 66 tests; the combined GitHub source count is 921, NOT 1005.
- Actual production owner JWTs: NOT read/verified. Real Meta/Zalo provider signed callback: NOT admitted. An isolated cryptographic test with synthetic private RSA/EC keys and synthetic App/OA secrets is not a real provider UAT.

Final release: HOSTED NO-GO. Preserve four original V17.15 Messenger nodes and published Messenger V17.17/Zalo V17.19. No production workflow, Auth user, Store owner mapping, credentials, secrets, customer/commerce data, payments or provider sends changed by this milestone.

Rollback: close the child Draft PR. The source-only gate has no deployment or live workflow to revert. The checkpoint documentation-only update triggers a new GitHub CI run; independently verify exact final HEAD again.
