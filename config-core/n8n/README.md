# TIEN404 CONFIG MENU BRIDGE (n8n sub-workflow) — DRAFT, not published

Generated from the tested libs: `node config-core/n8n/build-bridge.mjs > config-core/n8n/bridge.sdk.js`
(`config-core/test/bridge-bundle.test.mjs` runs the embedded Code node).

- n8n: workflow `9HXjjJ5ghPKUu43b`, folder "05_TIEN404_DEV_FACTORY - STAGING", NOT published.
- Inputs: `channel`, `accountId`, `payload`, `text` (already verified by the channel adapter).
- Reads `public.get_channel_menu` (db/config-core/20, PROPOSED — needs anon EXECUTE approval) with the
  public publishable key; 3 s timeout; any error -> `{mode:'legacy', configSource:'read_failed'}` so the
  current Messenger flow keeps working.
- Output modes: legacy / ai / handoff / direct / greeting / rejected (see `config-core/lib/bot-bridge.mjs`).
- Pinned tests 2026-11-22: exec 6689 (handoff -> sales wording, configVersion 2), exec 6690 (read error -> legacy).
- Wiring into Z7Fd = one Execute Workflow node before the AI agent; separate approval (Z7Fd is live).
