# TIEN404 — CBOT-MSG-CANARY-02C
## Meta App Administrator Evidence × Real n8n 13-Case Canary Guard QA

**Checkpoint:** 2026-11-16 JST. Parent [Draft PR #214](https://github.com/ngoctien20/demo-git/pull/214) remains open; no merge/production release.

### A. Actual Meta screenshot and browser read-only
- User-provided Meta Developers app-role screenshot for **TIEN404 AI Messenger** clearly shows the user's account listed as **Quản trị viên / Administrator**. This is **NATIVE UI ROLE VISIBLE** for the developer **App**.
- User directly attests they own/fully control the Facebook Page and authorizes Canary testing. Record **OWNER-ATTESTED** Page control; the screenshot does **not** show the Page's Business asset Full Control privileges or a native Page↔App subscription result.
- Read-only connected Meta test-user tab showed App publish status **"Chưa đăng"** (unpublished). Developer/admin tests may work while app access to arbitrary external Facebook accounts is not yet established. Do not toggle publish/App Review, create test accounts or generate access tokens.
- Previous verified LIVE01 Messenger webhook #4176 used signed Meta webhook and received a user-confirmed reply. Those functional observations do not prove the future canary recipient has a valid app role/permission.

### B. Actual new manual n8n QA — real execution #4180
**Safe mutation scope:** created only a NEW, **INACTIVE** 4-node QA workflow in Personal project / `90_QA - DIAGNOSTICS`:
- ID: `bOaSukunPYUWg2pS`; link: https://ngoctien20.app.n8n.cloud/workflow/bOaSukunPYUWg2pS
- Name: `TIEN404 Messenger Owner Canary Guard — 13 Cases [INACTIVE NO SEND]`
- Graph: **Manual Trigger → 13 Synthetic Meta QA Cases → Offline Guard Page/PSID/HMAC/Replay/TTL → Assert Decisions**.
- No webhook, Meta/HTTP request, Code node credentials, Supabase, Data Table, AI Agent, paid model, Orders, Page token or external recipients. Four nodes of Manual/Code types and no published version.
- Executed **exactly once manually**. n8n execution `#4180`, 2026-11-16T12:45:51.996Z–12:45:53.726Z, **SUCCESS**, 4/4 nodes executed successfully.
- Summary contract `TIEN404_CANARY_OWNER_GUARD_13_CASES_QA_V1`: **13/13 expected decisions PASS; 1 permitted QA preview, 12 denied**, 0 Messenger sends, 0 Orders, 0 paid model calls.
- Negative cases: replay, wrong Page, wrong sender, synthetic HMAC failure, missing consent, expiry, wrong config version, order intent, forged user approval, wrong channel, non-tester external account and untrusted source.
- **Critical limitation:** "sigVerifiedFixture" is a **synthetic boolean**, not independently validated native HMAC. Fake QA Page/recipient strings are not actual Meta account identifiers. This proves offline routing logic only. It does not demonstrate an authorized Page-only LIVE02 send.

### C. Live safety cross-check
- Live Messenger `Z7FdV7uDvApfbURQ` remains ACTIVE 27 nodes, exact Published version `d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92`. It still has five business toolWorkflow connections on its legacy Agent.
- Existing manually simulated greeting Canary `VSmXkK7Y1Bb3Dg2w` remains separate and inactive. Do not merge/re-route either QA workflow into live Page.
- Last source-only insertion blueprint has a deterministic QA branch after signed HMAC + dedup, before legacy Agent, rejoining existing single Meta Send node. The blueprint is **not** yet an actual or tested n8n Published patch.

### D. Explicit authorization decision
- **APPROVED by owner for QA:** Prepare code/CI, use synthetic manual n8n tests, audit read-only; completed.
- **NOT AUTHORIZED for Live:** No Page token, private QA recipient identity, role/permission/Store binding, exact diff and rollback, or second independent security acceptance has been established. This checkpoint does not approve an arbitrary production edit or send.
- **No repeat of LIVE01 necessary**. It is accepted, and screenshot now confirms native App Administrator role.
- **Two distinct release scopes:** Page-only greeting test may be considered after private Page/recipient scope proof and no-writer release approval; real Store-scoped Commerce needs canonical Store/JWT/RLS and backup separately. Do not conflate a successful greeting with real multi-store Commerce authority.
- **App unpublished:** Only use an authorized developer/tester account; broad public Messenger rollout and App Review remain separate release gates.
- **Rollback:** Closing Draft PR removes only newly authored GitHub files. New n8n QA workflow `bOaSukunPYUWg2pS` persists **inactive** and retains execution evidence. No deletion, no change to Meta, n8n Published, Supabase, customer data or credentials occurred.

### E. Smallest useful next evidence
User can navigate **Meta Business Suite → Settings → Page access** for exact Page Full Control; in Meta Developers confirm Page is attached/subscribed and identify designated tester's role **privately**. Do not post or share Meta IDs, token, PSID, raw Graph API responses or screenshots with secrets. Then create a separate reviewed **inactive no-write n8n patch candidate** with exact graph diff and private rollback snapshot; obtain specific approval for one controlled send **before** cutting over Published.

**Evidence:** `qa/cbot-messenger-canary02/owner-app-admin-canary-qa-4180-evidence.json` (privacy-safe), 10 source contracts. Existing 199 Canary-02B regressions reused.
