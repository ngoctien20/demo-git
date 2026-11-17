# TIEN404 AI — V17.23U Dedicated QA Bot Private Ingress

**Do not set the Zalo QA Bot webhook yet.** This milestone separates safe staging deployment from authenticated provider admission and one real event.

## Starting state (verified)
- Parent V17.23S: [Draft PR #388](https://github.com/ngoctien20/demo-git/pull/388), HEAD `8e116aa78d5fb187496c1375089baf6658b6f457`.
- The owner confirms they created a distinct Zalo Bot QA and its local Windows preflight returned `QA_BOT_GETME=PASS`. Their subsequent authenticated Zalo Bot Creator view shows this Bot has **no configured webhook**; `getWebhookInfo` returned HTTP 200 with API `ok=false`, `error_code=404`, so that API alone is inconclusive.
- Existing staging Bot remains on its prior n8n callback: do not use its credential or overwrite any callback.
- V17.23S receiver: source-only and 411/411 synthetic CI. It was NOT a deployed Worker and had no D1 binding.
- Official Zalo Bot webhook docs document the envelope `{ok:true,result:{event_name,message}}`; an independently reported live Zalo Bot integration observes flat `{event_name,message}`. V17.23U refines the existing receiver to permit exactly these **two** shapes, rejecting malformed/ambiguous wrappers, preserving header verification, challenge, private chat, time bounds, single-slot atomic D1 insert, no send, and no Commerce access.
- Zalo Bot webhook header `X-Bot-Api-Secret-Token` is a bearer-style shared secret — **not** a payload HMAC or independent customer identity proof.

## Deployment and admission gates

Track U-A (**safe, inert staging Worker only**):
1. Upload a new dedicated Worker `tien404-v1723u-qa-bot-inbound-locked-staging` as **inert 404** with no secrets, no routes, no D1 binding, no domain.
2. Disable `workers.dev` and preview exposure. Independently read deployment metadata and verify this script is NOT attached to a zone route or Worker Domain.
3. Upload/test vetted source to same Worker only while no public route, credentials, binding or active admission mode exist. With missing `QA_CANARY_MODE` it returns 404 for all methods and paths.
4. Log only checksum and nonsecret deployment metadata; never issue token-bearing requests or enable public routing in this phase.

Track U-B (**explicit independent approval required before provider receive**):
1. Verify the **new** QA Bot's owner through a separate private trusted UI, with distinct identification vs existing staging Bot and scoped one-message consent. Bot IDs and credentials stay outside public GitHub/chat.
2. Approve creation of a **new isolated D1** database, region/cost/usage cap, schema, retention and a tested rollback; do not share any of three existing D1 staging databases.
3. Approve QA-only Worker route exposure, WAF/rate limits, independent no-send monitor, private `QA_HEADER_SECRET` (Bot Creator webhook Secret Token **not** Bot API token), `QA_EVENT_PEPPER`, random `QA_CALLBACK_PATH`, `QA_CHALLENGE`, `QA_START_MS` and `QA_END_MS` (max 30 minutes). No service role, no customer tables, no n8n Commerce link.
4. Verify one negative request does not get ACK before registration; test D1 atomic single-slot and use no logs of raw payload before opening.
5. Change **only new QA Bot's** webhook in its Bot Creator UI with explicit owner consent, observe its callback setup read-only; never edit the existing staging Bot.
6. Authorized test person sends **one** challenge to new QA Bot; verify incoming event via independent Worker/D1/Provider logs without raw message or user ID in GitHub. Check wrong-secret, replay, duplicate, expiry, forbidden nonprivate sender and no outgoing send.
7. Close receiver mode and revert QA-only callback via owner-approved rollback. Keep short-lived redacted receipt in approved private vault.

Track U-C (**Commerce JWT**) remains NO-GO: M0, canonical Store A/B ownership, Store-scoped RLS and real Auth issuer/session proof are absent. No Order reads.

## Safety and rollback
- No new credential, provider webhook change, customer data, order write/send, production workflow modification or real event until U-B.
- Source PR rollback = close Draft PR. If an inert Worker was created, it should remain disabled until separately approved cleanup rather than attempting an unapproved destructive delete.
- Cloudflare D1 has a Free allowance but account plan/usage and all future costs must be verified before any provisioning. Do not assume the next database cannot incur fees.

## Sources
- Official Zalo Bot webhook (wrapper & header): https://docs.zaloplatforms.com/docs/BOT/webhook
- Third-party live observed flat Zalo event: https://github.com/dderek0/quest/blob/main/zalo-bot-docs/api-reference.md
- Cloudflare D1 limits and pricing: https://developers.cloudflare.com/d1/platform/limits/ and https://developers.cloudflare.com/d1/platform/pricing/


## Actual hosted checkpoint — 18 Nov 2026 JST (operator read-only verified after writes)

**IMPLEMENTED (Cloudflare staging only):**
- Created new Worker `tien404-v1723u-qa-inbound-locked-staging`, initially an inert 404. Fixed Cloudflare compatibility-date validation by selecting `2026-11-17` UTC-compatible date.
- Set `workers.dev=false` and `previews_enabled=false` BEFORE uploading the candidate full receiver.
- Uploaded exact GitHub `qa/v1723s/isolated-qa-webhook.mjs` source at blob SHA `8a508bac76ad4dde64dd88789b8b8e654ac51a8b`; Cloudflare response script ETag `8e1b26e0e28dcd90543225a4477aa14a9a44b12a2947dff45e85eb2de993e1d4`; verified Cloudflare content/v2 includes identical GitHub source.
- Created a **new** isolated APAC D1 `tien404-v1723u-qa-bot-once-disposable`, applied the single-slot `qa_canary_once` table schema and bound it as `QA_EVENT_DB` to this NEW Worker only.
- Read-only postflight: `workers.dev=false`, preview=false, **0 zone routes**, **0 custom domains**, exactly **1 D1 binding**, **0 credential bindings**, D1 **0 event rows**. No configured `QA_CANARY_MODE`, so the deployed receiver is inert 404 and **cannot accept provider traffic**.
- No change to existing Zalo staging webhook, n8n Published, Supabase Commerce/Auth, Meta/Zalo credential, Order or customer.
- D1 creation/schema are a scoped isolated QA infrastructure write. D1 pricing is usage/storage based, with Free included quotas; account subscription details were not available. No paid resource upgrade was initiated. **Recheck billing before any public route, message test or sustained D1 use.**

**NOT TESTED:** Cloudflare Worker request runtime through actual ingress, real D1 write via a live Worker invocation, native Bot Secret Token verification, real single Zalo event, independent operator/Owner no-send evidence. Github source CI is not equivalent to these hosted checks.

**BLOCKED:** public/QA-only callback exposure and webhook enrollment until explicit scoped Owner approval, approved private secret handling, time-bounded variables, callback test and rollback. Never use existing staging Bot; avoid exposing the random callback path or shared secrets in public GitHub/ChatGPT.

**Rollback plan:** leave this QA Worker with workers.dev/preview off and no routes; no provider rollback needed because no webhook was changed. Deletion of the isolated D1/Worker is a separate destructive step requiring authorization. Closing Draft PR reverts only source changes, not these new hosted QA resources.
