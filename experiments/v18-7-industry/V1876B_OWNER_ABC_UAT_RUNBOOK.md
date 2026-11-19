# TIEN404 V18.7.6B — Protected Owner A/B/C Real Auth UAT Runbook

Date: 2026-11-19 JST | PREPARED ONLY | REAL AUTH NOT TESTED

## Required approval and readiness
1. Owner approves isolated private staging and test identities. No real JWT/token/customer details may be pasted into ChatGPT, GitHub, CI logs or n8n.
2. Canonical Store Authority design from Draft PR #420 has independent security review, collision analysis and owner-approved migration. Do not copy its synthetic SQL into Supabase.
3. Backup/restore dry-run with evidence and rollback; real tenant/store mapping and Store-level composite constraints verified.
4. Store-scoped RLS and authenticated session verification are deployed under a separate approved staging change, not this PR.
5. Real test users are privately verified in Supabase Auth. User-visible claims or synthetic request.jwt.claim.sub must never be treated as a verified session.

## Required real test actors
- Tenant A Owner A: owns Store A; read Store A only.
- Tenant A Owner C: owns Store C; same Tenant as A, same SKU may have different price and stock.
- Tenant B Owner B: independent tenant, read B only.
- Staff A: can read allowed catalog, no privileged customer/order, no store admin actions.
- Revoked owner: cannot read Store data.
- Each Page/OA/Website connection must map to a single server-verified Store installation.

## Protected read-only UAT matrix
| Test | Expected acceptance | Current status |
| --- | --- | --- |
| A reads Store A catalog | Allowed by Store RLS | BLOCKED |
| A reads Store C same-tenant SKU/price | DENY / 0 rows | BLOCKED |
| C reads Store A | DENY / 0 rows | BLOCKED |
| B reads any Tenant A Store | DENY / 0 rows | BLOCKED |
| Staff A reads private customer/order | DENY | BLOCKED |
| Revoked owner reads catalog | DENY / 0 rows | BLOCKED |
| Page A claims Store C | DENY | BLOCKED |
| Private Commerce reader accepts A with signed context | Only Store A, no sends/writes | BLOCKED |
| Three RPCs under approved Store-level callers | Correct role and owner scope | BLOCKED |

## Acceptance and evidence collection
- Use a protected server-side test harness with actual authenticated Supabase sessions; never inject a fake JWT sub or use the service_role as the user.
- Collect only redacted booleans, row counts, suite version, audit references, timestamp and environment identifier. Never expose access or refresh tokens, PSID, emails, phone numbers or real customer rows.
- Verify expired/revoked sessions, deleted membership, same-tenant Store A/C isolation, Page installation revocation and unauthorized admin/write rejection.
- On any mismatch: FAIL CLOSED. No real read-only Commerce admission.
- A release gate requires signed-off independent QA plus explicit owner authorization for each actual migration or canary.

No real Auth test or database migration occurred in V18.7.6B.
