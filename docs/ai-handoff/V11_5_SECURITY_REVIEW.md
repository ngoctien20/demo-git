# TIEN404 V11.5 — Security Review (13/11/2026)

**Scope:** Read-only connector audit of Supabase staging, GitHub branch and n8n workflow metadata. No pen-test on real users. No production edits.

## Findings

| Level | Finding | Evidence | Action |
|---|---|---|---|
| **P0 review gate** | `public.save_merchant_product` is `SECURITY DEFINER` callable by `authenticated`. A deliberate QA-only design may still be acceptable only while tenant allowlist & role checks are correct. | Supabase Security Advisor `authenticated_security_definer_function_executable`. V11 checkpoint verifies PT409 stale / wrong shop denied at QA staging. | Re-evaluate SQL definition, deny anon, restrict EXECUTE, signed JWT A/B + member negative tests; don't widen allowlist until approval. |
| **P1** | Leaked-password protection disabled | Supabase Security Advisor `auth_leaked_password_protection` | Evaluate enabling in Auth settings after assessing users & approval. |
| **Info / intentional possibility** | 8 private tables have RLS without policies | `app_private` and `factory_private` Advisor `rls_enabled_no_policy` | Confirm server-only schema; don't add permissive policies just to clear lint. |
| **P0** | Notification duplicate if multiple workers race | V4.5 Data Table read-then-insert prototype only | Move to DB private `UNIQUE (tenant,event,channel)` and atomic claim; negative two-worker test. |
| **P0** | Cross-store notification leakage | Current V4.5 simulated allowlist only | Must bind tenant/merchant identity from Auth server session and authorized channel mapping; never from prompt/client. |
| **P1** | Zalo OA App/UID consent, approved template and costs absent | Zalo docs and no Zalo credential verified | Send disabled by default. No token in frontend, no scraping/cookie bot, per-OA scope and audit. |
| **P1** | Meta PSID window/policy validation only simulated | Messenger policy QA `2688` | Verify owner PSID via HMAC webhook + eligible permission before send. |
| **P1** | Unknown delivery/timeout can duplicate sends | No provider-side exactly-once guarantee | `needs_review` state, reconcile before retry or backup channel. |

## Security rules / rollback

- Production Live Messenger workflow `Z7FdV7uDvApfbURQ` and AI SALES DEMO tools remain untouched.
- No Zalo tokens or personal identifiers are embedded in GitHub branch.
- GitHub V11.5 module is no-IO; draft PR may be closed/reverted without customer impact.
- SQL in `V11_5_NOTIFICATION_V5_POSTGRES_CANDIDATE.sql` **NOT APPLIED**. If later applied, migrate only after backup/restore plan, signed-auth QA and owner approval.
- Avoid `SECURITY DEFINER` functions exposed to `anon/authenticated` unless strictly justified, individually reviewed and permission-revoked by default.

## Verification links

- Supabase Security Advisor: https://supabase.com/docs/guides/database/database-linter
- RLS guidance: https://supabase.com/docs/guides/database/postgres/row-level-security
- GitHub PR: https://github.com/ngoctien20/demo-git/pull/32
