# V18.0-P0L — No-Console Private Auth Evidence UI (SOURCE-ONLY CANDIDATE)

**Status:** PROPOSED → SOURCE IMPLEMENTED → OFFLINE QA. **Not deployed. No JWT real UAT.**

## Purpose and why
Existing Auth Render staging deployed from \`work/supabase-auth-staging-v1\` exposes \`login.html\`, \`account.html\`, \`getAuthClient()\` and the authenticated user's tenant-membership cards. The P0J console script requires manual DevTools use, which is error-prone and triggers browser self-XSS warnings. The P0L candidate gives two consenting QA owner account operators a simple mobile-friendly **separate page and button**, with no Console interaction.

## Files and future staging-only copy plan

- \`qa/v180-p0l/private-auth-evidence.html\` is a standalone noindex page.
- \`qa/v180-p0l/private-auth-evidence-core.mjs\` exports a read-only Auth and tenant owner fingerprint check.
- \`qa/v180-p0l/private-auth-evidence-ui.mjs\` operates the UI without transmitting outputs.
- \`qa/v180-p0l/private-auth-evidence-core.test.mjs\` uses synthetic Auth client objects.

**Not part of public website, Merchant Portal, Core Bot or production.** If separately authorized later, the Website Team should review and copy to the dedicated Render Auth staging branch as \`auth-evidence.html\`, \`assets/private-auth-evidence-core.mjs\`, and \`assets/private-auth-evidence-ui.mjs\`, update the explicit allowlist and HTML-page loop in \`scripts/build-auth-preview.mjs\`, and deploy **only to controlled staging** with rollback plan and review of Access controls. Do not merge Draft #385 to \`gh-pages\` or enable this screen for customers by default.

## Zero-write operator protocol (future)

1. Owner A consents and signs in to trusted Auth staging using their own browser profile. Opens staging \`/auth-evidence.html\`, leaves nonce blank and clicks the read-only test button.
2. Owner B consents independently and signs in using a separate browser profile. Opens same page, inputs A's one-time comparison code and clicks.
3. **Locally** compare actor codes (must differ) and tenant owner codes (must share one value). No emails, user IDs, session IDs, JWT, secrets, order or product rows appear in output or GitHub.
4. A browser-local match is NOT a signed server receipt, session revocation evidence or canonical Store ownership. Never use this code for RLS/privileged RPC decisions. Real Store A/B JWT UAT remains \`NOT_RUN\`.
5. If login, claims, consent, tenant RLS or network check fails, it reports BLOCKED and does not attempt any account creation, password reset or role modification.

## Safety and current gates

Only existing \`supabase.auth.getUser()\`, \`supabase.auth.getClaims()\`, and a subject-filtered RLS \`SELECT tenant_id,role,active FROM tenant_memberships\` are allowed. All outputs from Auth and RLS must be sanitized before display. Origin and route pinned to \`https://tien404-auth-staging.onrender.com/auth-evidence.html\`. No \`service_role\`, new app permissions, JWT in logs, third-party analytics, API server, provider sends, or customer data. Source is public, so **never embed private secrets**.

Current live Supabase cohort and Auth audit evidence do NOT demonstrate two separate live sessions for the target owner pair. The founder's confirmation of two different accounts is accepted; account pair does not establish same tenant until evidence is independently checked. Public Store Registry and \`store_memberships\` are absent, so Store A/B authority is NO-GO even with a positive UI test.

## Release / rollback

This PR change is source-only and does not alter Render, Supabase, n8n or production. Prior to any staging deployment, obtain scoped approval, review existing staging Auth branch lineage and build allowlist, use a private tester access gate and inspect CSP / dependency provenance. Since this is a public static page, \`noindex\` is not an access control. Only after an independent security review and appropriate access controls should live Auth sessions be tested there.

Backup M0 deferral applies solely to source-only/disposable QA; any real schema/RLS/grant change requires approved and tested restore evidence. Draft-source rollback via revert; no runtime rollback.
