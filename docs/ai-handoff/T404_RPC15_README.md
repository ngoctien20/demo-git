# TIEN404 RPC15 — Private R2 Binding Acceptance (SOURCE ONLY)

**Added to RPC14 draft; NOT deployed; no real Merchant evidence received.**

Read-only verification found an existing empty **private** R2 bucket, Standard class, APAC, with direct `r2.dev` public URL disabled and no custom domains. A Cloudflare token inventory is **not accessible** under the current connector permissions; this work did not create credentials.

This source adds an internal, no-token Worker R2 binding adapter. It performs `put` only, using create-only `If-None-Match: *`, SHA-256 verification, a strict UUIDv4 quarantine key, `application/octet-stream`, no-store, and `PENDING_MALWARE_SCAN` metadata. It has **no retrieval, listing, deletion, public HTTP handler or owner approval capability**.

## Local QA

```sh
node --test qa/v152-rpc15/private-r2-quarantine.test.mjs
```

Expect **45/45 PASS**. CI also runs inherited RPC14/RPC13 offline source-only tests. Do not paste API tokens, JWT, customer documents or real Store owner evidence into GitHub.

## Production gates

Read `docs/ai-handoff/T404_RPC15_PRIVATE_R2_ACCEPTANCE_CHECKPOINT.md`. Missing independent Access app, durable invite admission, trusted scanner, retention plan, original four Merchant row proofs, Store membership, real two-Store signed JWT UAT and recovery prevent rollout. These require explicit separate approval.