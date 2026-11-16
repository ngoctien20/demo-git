# V15 Messenger → Zalo NO-SEND QA

Synthetic-only test harness. `no-send-order-continuity.cjs` imports the **existing real V15 source-only signed QA gate** from `../v15-hosted-readiness/trusted-ingress-gate.cjs` when run inside the full repository. It has no network, webhook, provider send, Supabase Auth, paid model or hosted persistence.

Run `node --test qa/v15-cross-channel/*.test.cjs` from repository root. The JS tests use independently signed QA fixtures generated in memory (not real Meta/Zalo keys). The SQL script requires the parent PG17 fixture and MUST run only on disposable Postgres17 CI, never on Supabase hosted.

Passing tests demonstrate source-level behavior, **not** real provider authentication or host multi-Store RLS. The QA order response explicitly says `QA_PERSISTED_IN_MEMORY_NOT_HOSTED`.