# TIEN404 AI — CBOT-MSG-CANARY-02B
## Owner-Attested Native Meta Control × Exact Callback Match × Safe Insertion Blueprint

**Observed:** 2026-11-16 JST  
**Parent:** [Draft PR #214](https://github.com/ngoctien20/demo-git/pull/214), no Published deploy.  
**Scope:** Actual screenshot + connected n8n **read-only** inspection; source-only no-write insertion blueprint; CI. No credentials or Page/PSID identifiers committed.

### 1. Screenshot and owner testimony — separate evidence classes

- New user Meta Developers screenshot of the **Messenger API Settings** page shows green verified/completed configuration, Meta callback host `ngoctien20.app.n8n.cloud`, webhook path `/webhook/tien404-messenger-qa`, and **masked** webhook verification string. The visible rows are unrelated fields (affiliation/attire/awards/birthday/etc), all disabled. **The exact `messages` webhook row and present Page subscription status are not visible.**
- User directly stated they have **full control** of Facebook Page `Tien404 AI` and custody of their n8n integration/token. Mark `OWNER_ATTESTED`, **not** `INDEPENDENT_NATIVE_ADMIN_ROLE_VERIFIED`. No Page access token, app secret or verify token supplied and none requested or stored.
- These represent three distinct secrets/claims: **Webhook Verify Token** (for callback setup GET handshake), **Meta App Secret** (for verifying signed event HMAC), and **Page Access Token** (for Messenger Send API). Screenshot masks verify token; do not infer it shows either of the other two. Previous live #4176 execution HMAC verified true and Meta Send accepted, providing functional proof those activities worked in that run.

### 2. Exact read-only n8n structural cross-check

- Published workflow `Z7FdV7uDvApfbURQ`, `activeVersionId=d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92`, **27 nodes ACTIVE**.
- The **two existing n8n Webhook trigger nodes**, `Webhook` (**GET verification**) and `Webhook1` (**POST messages**), BOTH have path `tien404-messenger-qa`. That matches the visible Meta callback. This represents **one provider callback**, with separate GET handshake and POST event handlers; do **NOT** mistake them for two independently subscribed Pages.
- Actual signed inbound POST chain: `Webhook1 → Crypto → Verify Signature Timing-Safe → Verify Meta Signature → Respond to Webhook2 → Extract Messenger Text → Skip Duplicate Message ID → Loop One Message`.
- `Loop One Message` output index **1** currently targets `Messenger AI Agent`. Output index **0** has no processing path. Agent sends output to `Prepare Messenger Reply`, which reads the incoming `output` property, then to **one** `Send Messenger Reply - CONFIGURE TOKEN` node and Meta delivery check + dedup record.
- Agent still has five legacy business tools, including `create_order`, `update_order_address` and `manage_order`. **No live canary route is approved** with this Agent on the QA path.
- Real Messenger LIVE01 `#4176` succeeded with HMAC true, Meta send MID and user-confirmed reply. This provides FUNCTIONAL proof that `messages` was delivered for that authorized test interaction at that time, but not a complete independent Meta App/Page permissions audit.
- Separate manual n8n Canary QA `VSmXkK7Y1Bb3Dg2w` remains **INACTIVE**, two nodes, actual synthetic manual execution `#4177` PASS; does not send to Messenger.

### 3. Exact source-only cutover *insertion* proposal

File `qa/cbot-messenger-canary02/canary-exact-insertion-draft.json` defines the intended insertion after `Loop One Message` output **1**, **not** before HMAC/duplicate checks. It preserves:
1. Existing Meta callback GET+POST path, no new webhook.
2. Private native Page-owner-authorized allowlist + single test PSID authorization (not encoded in GitHub), exact marker `TIEN404-CANARY-LIVE02`, TTL and one-use guard.
3. Exactly **one mutually exclusive** branch for test QA; regular messages continue to original Agent unchanged. Canary branch generates deterministic `output` field and goes directly to the existing `Prepare Messenger Reply`; **zero model, HTTP, business toolWorkflow or catalog calls** on canary branch.
4. Exactly **one** existing Meta Send node; ensure no duplicate responder, single verified MID, and undo route to pinned Published version.
5. Owner-specific final graph SHA+version, signed operator release consent and independently verifiable rollback before any real edit.

**This is a reviewed source DESIGN, not an importable live workflow patch**, because actual n8n Code/If node parameters, private Page/QA PSID entitlements, node execution pairing semantics, existing MID dedup path and rollback need independent staging validation first. Never auto-create/activate a Page webhook, write private recipient IDs or change Meta settings based on this file.

**New tests:** `qa/cbot-messenger-canary02/callback-route-draft-audit.test.mjs` checks the visible callback/n8n path match, GET/POST distinction, exact 27-node live version and Loop index, only shared Prepare/Send, no tools/model/writer, fake permission/credential payload, missing HMAC/allowlist/TTL, duplicate response and wrong Page/path; release decision **always NO_GO_LIVE_PATCH**.

### 4. Operational authorization and next action

**Owner-approved purpose:** preparing a narrow Page-only Custom Greeting Canary with no Commerce data or order writes. The owner has separately identified themselves as having Full Control; preserve as a self-attested claim unless corroborated by provider-native privileges.

**Still pending for live SEND/cutover:** an independently validated exact Page/App authorization, private single QA recipient binding, actual no-writer node patch+staging regression, no-duplicate-Meta-responder check, versioned rollback and narrowly scoped explicit owner/security approval of the final patch. An old generic "run Canary" consent is not a signature approving a future unknown production graph diff.

No additional token registration, callback changes, OAuth refresh or Meta subscription toggles are needed for source-level preparation. If the App/Page `messages` subscription is uncertain in Meta portal, use native **GET** read-only review under operator-owned token privately; no need to send another LIVE01.

**Rollback:** close Draft PR to remove this source artifact; it does not remove independently created inactive n8n QA workflow `VSmXkK7Y1Bb3Dg2w`. No hosted/live modifications in Canary-02B.

**Milestone state:** `VERIFIED` callback path→n8n node + functional LIVE01, `OWNER-ATTESTED` Full Control/token possession, `IMPLEMENTED` exact insertion blueprint and negative QA, `BLOCKED` independently approved live patch/one-recipient SEND, `RELEASED` none.
