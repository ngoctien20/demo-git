# TIEN404 RPC13 — Private Merchant Evidence Intake × 2 Real Supabase Auth JWT Read-only UAT

2026-11-17 JST · **EXPERIMENTAL source-only** · Parent: RPC12 Draft PR #281 · No merchant data fetched, no hosted writes, no live provider sends.

## Evidence verified independently in this session
- Supabase staging `ifxlvrhyjhbzbrkdsida` PG17: 2 Products, 2 Orders, 2 Tenants, 3 active Tenant Owners corresponding to actual Supabase Auth users.
- Tenant slot 1 has **two confirmed Auth Owners** but **only one ever signed in** according to aggregated `auth.users.last_sign_in_at` (tenant slot 2 one confirmed and signed-in). `auth.sessions` includes five records globally; those do not prove two distinct simultaneous authenticated Store owners.
- No `public.stores`, `public.store_memberships`; none of six Commerce tables includes `store_id`.
- Existing `tien404_r1_qa.owner_bindings` / pairing tables are QA metadata; not independent Merchant ownership of real Commerce rows.
- Product/Order columns lack a trusted original Owner/Store identifier. Both Orders record `order_source='manual'`; original Event/Idempotency/Audit ledgers were empty when checked in RPC12. Four independent Merchant proofs **NOT RECEIVED**.
- Cloudflare account lists **one** Access-protected staging Pages app (`*.tien404-ai-git-staging.pages.dev`) with email allow policy. It is not evidence of a dedicated Merchant evidence intake route, private file quarantine, or independent reviewer policy. Do not upload merchant evidence to this existing staging site.

## Prepared architecture: NOT DEPLOYED
1. Dedicated **new** private Worker endpoint; Cloudflare Access per-merchant allowlist. Validate `Cf-Access-Jwt-Assertion` RS256 with pinned Cloudflare Access issuer/JWKS and audience, never trust unverified headers.
2. Validate **distinct** Supabase authenticated user via remote `/auth/v1/user`, no user_metadata authority, exact verified email comparison; independent of Access JWT.
3. Mandatory server-issued one-use invitation in a separate trusted registry binding Auth user ID, Access subject and a single private row slot (P1/P2/O1/O2). **Current invitation registry is not installed**. Owner cannot self-select canonical Store.
4. Accept limited PDF, PNG, JPEG files up to 8MiB; store only in **private R2 quarantine**. SHA256 check, no file serving, state `PENDING_MALWARE_SCAN`. Malware scan/CDR, replay/rate limit and signed durable receipts require separate infrastructure acceptance before enabling. No external URL fetching, HTML, SVG or executable uploads.
5. Independently authenticated Merchant attestation plus separate Reviewer identity verifying real primary-source proof, mapping original row to privately HMAC-bound canonical Store. HMAC alone is not proof of real ownership, and self-reported signature fields never release a migration.

## Exact four-row admission ledger (all BLOCKED)
| Slot | Dataset | Original source | Auth Merchant | Independent reviewer | Original Store |
|---|---|---|---|---|---|
| P1 | Product | missing | missing | missing | unverified |
| P2 | Product | missing | missing | missing | unverified |
| O1 | Order | missing | missing | missing | unverified |
| O2 | Order | missing | missing | missing | unverified |

**Do NOT** upload source documents/actual IDs/tokens/emails to the public GitHub repo, CI logs, chat, or screenshots. The private channel must be stood up separately after written security/retention approval and secret management. Never assume a Merchant wants to share private material without authenticated consent.

## Authentic real-JWT A/B UAT procedure — NOT YET RUN
Prerequisites: signed owner ledger, separately approved Auth+Storage restore, deployed canonical Store mapping and 6-surface RLS on isolated QA store data, two genuinely independent Owner A/Owner B sessions in **same tenant**, and private QA synthetic canaries for each of six surfaces. No real customer PII should be selected.

`uat-operator-cli.mjs` must run only on authorized operator machine outside GitHub CI. It accepts *paths* to two privately stored JWT files (mode 0600 on POSIX), not token literals; verifies each through live Supabase Auth `/auth/v1/user`, ensures different Auth users with matching same-Tenant membership and different Store memberships, performs 24 read-only positive/negative assertions over six tables via PostgREST. It prints no names, raw JWT, e-mails, row IDs or Store IDs.

Sample **only once prerequisites are independently reviewed** (replace paths on private operator machine):

```bash
node qa/v152-rpc13/uat-operator-cli.mjs --config /private/rpc13-approved.json --token-a /private/a.jwt --token-b /private/b.jwt
```

`uat-config-private-template.json` deliberately includes null canary identifiers and all admission flags **false**; setting flags without actual independent review is not authorization. Staging schema **currently makes real UAT impossible**. Do not create dummy real-owner proofs or backfill actual rows to unblock.

## QA, restrictions and rollback
- Source-only Node tests use generated RSA keys and mocked Supabase responses: **not real merchant identity or Auth JWT sessions**.
- Worker upload core requires separately deployed `authority` (transactional invitation registry), `quarantine` (private R2), verified identity configuration, malware scanner and human review. It is not a usable public upload endpoint in this draft.
- **No changes** to `public.save_merchant_product`, Auth credentials, RLS, canonical Store schema, existing Cloudflare Access policies, production bots, live customer data or billing.
- Rollback: close this source-only Draft PR and delete branch; no hosted rollback necessary.

## Signoff gates
G0 four original Commerce rows with primary merchant evidence and independently verified owner/reviewer; G1 backup+recovery; G2 dedicated Access private endpoint/managed secrets/quarantine/scanning/retention; G3 two genuinely authenticated JWTs same-Tenant Store A/B, independent UAT evidence; G4 Security + DB Operator explicit review for hosted cutover. All remain **NO-GO** until actual evidence supplied.