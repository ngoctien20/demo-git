# TIEN404 V17.1-C — Authorized Messenger Shadow Ingress × Server-Trusted Installation Mapping × No-Send Acceptance

Checkpoint: 2026-11-17 JST. **SOURCE+N8N QA PASSED. ACTUAL META PAGE → NEW SHADOW BOT NOT ACCEPTED / NO-GO.**

## Actual upstream authority (READ ONLY)
- Messenger Published workflow Z7FdV7uDvApfbURQ, 27 nodes, active version d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92, has native POST rawBody, credential-backed Crypto HMAC, timing-safe X-Hub-Signature-256 check, Page/recipient matching and live Meta Send API. It remains unchanged.
- Read-only real execution #4176: mode webhook, SUCCESS, Verify Signature Timing-Safe returned verified=true; Extract Messenger Text yielded one normalized event with Page/sender/message IDs present. No real IDs, message text, tokens or payload copied into GitHub, only field-presence metadata inspected. This does NOT prove the event reached the NEW shadow workflow.
- Zalo Bot staging/router and Commerce hosted remain unchanged. Independent Merchant Page/OA ownership and real Store binding NOT VERIFIED.

## New actual n8n QA implementation
- NEW standalone **INACTIVE** manual-only workflow AKgE96Xvbqxw4rGb, name TIEN404_V171C_AUTHORITY_BOUND_MESSENGER_SHADOW_QA_NO_SEND; six nodes, version dbfc0311-c08c-4c0d-86b9-92074608e127, no active version, no webhook or network/API/model/order send nodes, no assigned credentials. Project Personal, folder 90_QA - DIAGNOSTICS.
- NEW n8n persistent Data Table cnSZ6hT7WCbNwGl5, TIEN404_V171C_QA_INSTALLATION_BOT_BINDINGS_NO_SEND, in Personal. THREE SYNTHETIC rows only:
  - Fake Page 9900000001 → QA Store A → QA Bot A (QA-approved).
  - Fake Page 9900000002 → QA Store B → QA Bot B (QA-approved).
  - Fake Page 9900000003 → QA Store B → QA Bot B (REVOKED).
  - All share QA Tenant 1, all owner_authority_verified=false, approval_scope=SYNTHETIC_ONLY, read_only=true. No actual Meta Page ID, real buyer or merchant data; QA table is NOT production authorization or hosted RLS.
- Executable pipeline: manual signed Meta-shaped fake events → validate synthetic raw-body HMAC/recipient/timestamp/anti-spoof/replay → read persistent server-owned QA registry → bind Page to QA Store and Bot with policy/version checks → fake read-only price (A 159000 VND / B 259000 VND) → no-send guard.
- Actual MANUAL n8n execution **#4341 SUCCESS**, 20/20 expected: **3 QA_ALLOW, 16 QA_DENY, 1 QA_DUPLICATE**. Rejected bad HMAC/missing header, wrong recipient, client spoofed Tenant/Store/Bot, unbound/revoked Page, stale/future, echo, conflicting replay, wrong route and unsupported message. Outputs: model_calls=0, provider_sends=0, orders_written=0, real_meta_webhook_received=false, page_owner_verified=false, hosted_store_rls_verified=false, MOCK_ONLY_NOT_SENT.
- This test uses a clearly FAKE public HMAC test string, NOT real Meta App Secret, NOT actual Page owner consent and NOT authenticated live Meta callback. Replay guard is in-memory ONLY, not durable across workers.

## GitHub source and QA
- Reused OPEN DRAFT PR #243 instead of creating another competing PR. Store/RPC PR #237 and Messenger one-shot PR #239 remain separate NO-GO release tracks.
- Stored a read-only exact n8n graph + 3-row synthetic registry + metadata-only execution #4341 in qa/v171c-shadow/inactive-n8n-shadow-qa-snapshot.json.
- qa/v171c-shadow/test_snapshot.py contains 40 strict source/security snapshot checks. The GitHub Actions workflow .github/workflows/v171c-messenger-shadow-nosend.yml validates the source graph, inactive/manual-only trigger and no creds/live action.
- Inherited source suites: V17.1-A 83 Node QA, V17.1-B 60 Node QA, 5 synthetic smoke. Final CI run and SHA must be checked at final PR HEAD before claiming Github TESTED.

## Release / approval gates
- GO: additive source QA, inactive n8n QA workflow, fake persistent registry and synthetic protocol negative tests.
- NO-GO: genuine Meta Page/App-owner-to-Store authorization, hosted Store A/B JWT-RLS, real signed Page event to NEW Custom Bot, durable replay under concurrency, live Meta reply, paid model, Commerce data access/write, Core Bot promotion.
- A signed event previously accepted by existing Published workflow is NOT evidence that new shadow routing works.
- The user has not granted a bounded specific permission to change the live Page callback/subscription, invoke Send API, modify production credentials or hosted Store DB. Do not silently change any of those.

## Next high-value acceptance
1. Privately verify Merchant Meta Page/App ownership, current callback route and proposed shadow mechanism, without exposing Page token or customer PSID to public GitHub.
2. Obtain specific authorization for a separate nonproduction owned Page callback, or an audited isolated shadow handoff AFTER native HMAC verification. Never treat a client-provided verified=true or store_id as authority.
3. Prove unique server-trusted installation→Store→Bot mapping backed by actual merchant Owner, revoke state and Store/JWT-RLS. QA Data Table with fake rows cannot serve real customer traffic.
4. Execute one or more permitted actually signed real Meta events through the NEW no-send shadow path and record a private execution ID, with PII-safe metadata only. Prove no outgoing HTTP Send, no Commerce writes, no paid model calls, no replay and rollback.
5. Only then consider the separately gated one-shot live canary in PR #239.

Rollback: Close Draft PR #243 and leave new QA workflow inactive; do not delete/rename QA table or archive the workflow without explicit user approval. Messenger Published, Zalo, existing QA, Supabase hosted, credentials, customers, Orders and billing untouched.

**VERIFIED existing Messenger signature event #4176: YES. TESTED persistent n8n QA Store Bot mapping #4341: YES. VERIFIED actual Page to NEW shadow Bot: NO.**
