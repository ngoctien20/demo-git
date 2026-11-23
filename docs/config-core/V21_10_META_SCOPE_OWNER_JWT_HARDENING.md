# TIEN404 AI V21.10 — Meta Scope × Real Owner JWT Read-Only Safety

**Checkpoint:** 2026-11-23 Asia/Tokyo. Draft PR #493, branch work/v21-ai-social-reactions-qa-20261122.

**Release decision: NO-GO.** No hosted reaction migration, no real Meta auto-reaction, no Page policy publish, no credential/tenant changes.

## 1. Existing verified baseline from V21.9

- Config Core step 10 installed on staging by owner-approved direct psql GitHub Actions #44996262167, with encrypted backup and hosted UAT 21/21 PASS. Step 20 public menu getter installed by GitHub Actions #44998110645, with encrypted backup and UAT 9/9 PASS. This explains the absence of Config Core names in Supabase CLI-managed migration ledger; do not replay 10/20 or modify ledger automatically.
- Source-to-hosted SELECT-only parity: 45/45 columns, 11/11 function bodies/grants, 12/12 constraints/indexes/triggers, five policies and five forced-RLS/GRANT checks PASS. Checkpoint: docs/config-core/V21_9_META_OWNER_MIGRATION_PROVENANCE.md.
- Reaction proof, nonce and Page-draft schema remains absent on Supabase hosted. Messenger reaction Shadow Gate remains ALL OFF.

## 2. Meta Developers/Test App — live evidence BLOCKED

Browser connector still responds: "Browser access requires the originating browser context." No owner-authorized Meta Developers Test App tab or real Meta token is accessible in this chat. Meta Business Suite inbox access is NOT TIEN404 App OAuth installation proof.

No authenticated Meta Graph GET was executed, no Page permissions changed, no Meta token requested/exported and no provider reaction was sent.

Before marking Meta VERIFIED, a trusted server must gather read-only evidence for: actual Test App ID/mode/review eligibility; the User token's valid app binding and granted permissions from debug_token; selected Page's MESSAGING task via me/accounts; the correct app subscribed to the Page messages webhook; exact Page-to-tenant/store/owner match; one-time OAuth nonce and trusted signed installation receipt. Owner consent to reactions is a separate requirement. Do not enter tokens or app secrets into chat or public GitHub.

## 3. IMPLEMENTED — stricter Page-granular OAuth evidence assessor

Updated config-core/lib/meta-page-graph-evidence.mjs. A complete granular_scopes array from debug_token is now required. For each required permission (pages_show_list, pages_manage_metadata and pages_messaging), there must be exactly one entry. Missing/duplicate entries block. If target_ids exists, it must be a nonempty list of string Page IDs including the selected Page; malformed/numeric/empty/wrong-Page lists block. A permission applying globally may omit target_ids, but ONLY if the corresponding granular entry actually exists; the Page MESSAGING task and subscribed-app messages field must also match. All decisions remain attestable_candidate, sendAllowed:false. There is no signer/issuer, send or Graph call here.

CI includes negative tests for missing/duplicated scope entries, Page-ID precision, omitted granular response and global permission behavior. A conservative block is intentional if provider proof is incomplete.

Official Meta references:
- https://developers.facebook.com/docs/graph-api/reference/debug_token/
- https://developers.facebook.com/docs/facebook-login/guides/access-tokens/debugging/
- https://developers.facebook.com/docs/graph-api/reference/page/subscribed_apps/

## 4. IMPLEMENTED — Owner A/B Auth JWT runner safety

Updated qa/reactions/owner-auth-jwt-readonly-uat.mjs. The runner only accepts an sb_publishable_* API key (not sb_secret_ or service_role). It locally examines the JWT format, Auth issuer for the specific staging Supabase project, authenticated role/audience, valid expiry/iat and sub UUID; rejects alg=none. **Local claim parsing is not signature validation.** The actual GET /auth/v1/user must verify the JWT and return the same subject, with two distinct authenticated users. Calls are GET-only, staging-host pinned, redirect disabled and no JWT/key/owner IDs are logged. Owner A/B cross-store and anonymous-denial checks are retained.

Updated qa/reactions/owner-auth-jwt-readonly-uat.test.mjs uses fake-signature JWT-shaped strings ONLY with mock fetch. Real JWT Owner A/B UAT remains BLOCKED until two independent, explicitly authorized real Auth sessions are available. Never paste those JWTs into chat. Supabase reference: https://supabase.com/docs/guides/getting-started/api-keys

## 5. TESTED and limitations

- Social Reactions CI #45040103657 SUCCESS, **135/135 Node tests PASS**, disposable PG17 Owner/Page Draft and atomic ledger jobs both PASS. These results establish offline control behavior, not real Meta/Supabase Auth provider authority.
- Config Core and Owner Preview are tested independently. The V23 aggregate remains known to FAIL a compiled Owner App assets synchronization gate; do not disable this release gate or deploy preview source to hide it.
- No hosted Supabase writes, Meta sends, credential modifications, n8n workflow mutations or PR merge.

## 6. BLOCKED gates / rollback

1. Real Meta Test App read-only Graph/permission evidence from originating connected browser + trusted gateway.
2. Real independent Owner A/B signed JWT sessions for GET-only UAT; role-switched SQL simulation is insufficient.
3. Fresh encrypted staging backup and same-artifact restore to disposable PostgreSQL, migration tracking/release review and explicit owner approval.
4. Separately approved trusted proof writer, policy consent, publish and Meta sender.

**Status:** VERIFIED = prior V21.9 staged Config Core parity and origin; IMPLEMENTED/TESTED = V21.10 guards and mock/offline tests; BLOCKED = live OAuth, real JWT, backup restore and migration; RELEASED = none.

**Rollback:** Revert only V21.10 Meta assessor/JWT runner and their tests/document in Draft PR #493. Database/provider rollback is not required because no live writes occurred. Do not alter concurrent Messenger Menu work.

**Next step:** owner-authorized Meta Developers Test App read-only examination using the originating browser in ChatGPT Work, plus Owner A/B local real session UAT, then independent approval for backup/restore and staging migration. Reaction stays OFF.
