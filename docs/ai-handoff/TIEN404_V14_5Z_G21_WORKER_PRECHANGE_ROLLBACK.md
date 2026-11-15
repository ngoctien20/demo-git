# TIEN404 G2.1 — Credential-bound Staging Worker Pre-Change Checkpoint
Date: 2026-11-16 JST
Status: VERIFIED READ-ONLY BASELINE; LIMITED ATTESTOR CHANGE USER-APPROVED.
Script: tien404-zalo-outbound-v1-staging
Existing deployed version: ed172d3c-e1f1-4daa-bc56-643406441091
Existing deployment: 2ce7ea81-3755-47b1-afdd-a799db3da3c8
Original Worker source SHA-256 (private script, not committed): b1c58cf85e74b3e235807d4a5d731369bd15579e5076b18d8774f75e9f5351d3
Existing configured bindings (names and kinds only):
- GATEWAY_AUTH_KEY: secret_text (preserve)
- ZALO_BOT_TOKEN: secret_text (preserve, do not rotate/read out)
- ZALO_OWNER_CHAT_ID: secret_text (preserve)
- ZALO_OWNER_APPROVAL_EXPIRES: plain_text (preserve)
- ZALO_SEND_ENABLED: plain_text literal false (MUST preserve)
- REPLAY_DB: d1 (preserve)
No existing secret values read, exported, committed or rotated.
The test upload of UNCHANGED source as an UNDEPLOYED Worker Version 36783a59-6b42-4801-8dfb-47b3b644f6bf with strict inherited bindings succeeded: all 6 binding names preserved, deployed version unchanged.
Approved change scope: append exactly ONE authenticated read-only POST /v1/g2-provider-attest route; preserve all other handlers; provision two NEW isolated Cloudflare secret_key bindings for G2.1 ECDSA and HMAC; use only existing Zalo Bot Token internally to call official read-only getMe; no Bot ID or token in response. No public data writes, Orders, Zalo send, owner config, webhook, Bot Token change, or production.
Rollback: redeploy existing version ed172d3c-e1f1-4daa-bc56-643406441091 at 100%, then confirm ZALO_SEND_ENABLED=false and existing read-only getMe/webhook diagnostics. Do NOT delete old version or secrets without separate security approval.
Source and standalone 30-case negative QA:
- qa/zalo-live-v145z/g21-provider-attestor-route.mjs
- qa/zalo-live-v145z/g21-provider-attestor-route.test.mjs
CI 43755059657 SUCCESS.
No actual signing key provisioned at the time of initial checkpoint.
