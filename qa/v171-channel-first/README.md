# TIEN404 V17.1-A — Channel → Store → Custom Bot → Read-only AI Sales Core → Mock Outbound

**Runnable source-only QA candidate.** It is not a deployed n8n workflow, production adapter, real LLM call or hosted Store RLS proof.

Requires Node.js 22+ only, no dependencies, keys or network. From repo root:

    node --test qa/v171-channel-first/vertical-slice.test.mjs
    node qa/v171-channel-first/smoke.mjs

The same test-only pipeline processes Messenger Pages A and B, Zalo OA B, Website Widget A and another-Tenant Page C. A/B are Stores in the SAME QA Tenant; share SKU QA_SKU_001 but have different prices/stock/names and distinct approved Bot, Prompt, Knowledge and Policy versions.

The only trusted Store comes from the fixture installation registry. Untrusted tenant_id/store_id/bot_id and verification_status fields are denied. Only catalog_read can run, scoped by the installed Store and verified synthetic fixture; real writes and sends throw. Outbound retains the same channel installation and customer identity. In-memory dedupe blocks repeated event IDs, but does NOT provide cross-worker durable idempotency.

**Important:** QA HMAC keys are deliberately fake public test constants. Their signature is NOT actual Messenger, Zalo or Website webhook verification, and this mock does not test real Page/OA ownership, JWT-RLS, DB isolation, provider rate limits, an LLM or Meta Send API. No real merchant data was used.

Source-only security QA can GO if CI is green. Hosted Store A/B, provider sends, model calls, Commerce write and Core Bot release remain NO-GO. Next actual staging step should be an INACTIVE n8n candidate bound to existing verified adapters, real n8n execution IDs, and a mock outbound; do not touch the Published Messenger graph.
