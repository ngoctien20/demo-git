# TIEN404 V13.5 — CURRENT VS LEAN ARCHITECTURE

## Current observed state (verified components, not complete E2E)
```text
GitHub Pages public gh-pages  -> PR #74 real Auth redirect -> Render Auth staging
                                                        -> Supabase Auth / tenant membership
                                                        -> Render Merchant Portal (old V12.2 live)
Cloudflare Pages custom Preview v133 -> V13.3 Studio and Merchant QA fragments
Render Data FastAPI -> bearer Supabase JWT -> PostgREST/RLS (read-only routes)
n8n Zalo / Messenger / Sales Demo / Commerce Sandbox -> isolated workflows and tools
PR #73 -> improved account-only SOURCE DRAFT (not Render LIVE)
PR #70/71/72 -> other Sales Lite UI/entitlement SOURCE DRAFT (not unified runtime)
```

## Lean target — single Auth and platform service identity
```text
Public Website (marketing) -> Real Supabase Auth
                             |
             Verified platform account / independent RBAC
                |               |                 |
       Customer Portal     Staff Console     Admin Platform
          | own shop        | assigned        | Admin / Platform Owner
          | orders/status   | Bot/Catalog     | audit, subscription
                \            |                /
                 Shared trusted backend services
                   - tenant & channel resolver
                   - plan entitlements / staff assignments
                   - Sales Core + Order Request Engine
                   - Product & Customer data
                   - notification outbox / support / audit
                             |
               Supabase Postgres + RLS + transaction gates
             (AI Studio modules FUTURE / PRESERVED off main menu)
```

## Decisions
1. **One** Customer Portal on Render Auth; do not add a competing V13.4 Portal. Our V13.5 branch extends PR #73 only.
2. Merchant account: overview, own orders, TIEN404 billing, plan, profile, support. Shop owner cannot see raw product editor, Bot Designer, workflow or Admin.
3. Staff role is a separate platform grant and assigned shop; merchant `owner` != Platform Owner.
4. Platform Owner elevated mode lives in Admin Platform behind MFA + audit, not public personal account.
5. No new SQL or Auth service in this stage. Existing Data/Commerce source remains for reuse once ownership/entitlement proven.
6. Read-only order UI gets tenant scope from Supabase membership, filters PostgREST with tenant_id, rechecks all result rows, hides on scope/logout change. RLS remains the authoritative protection.
7. Payments collected vs TIEN404 subscription invoices are distinct. UI must not equate `orders.status='paid'` to verified payment settlement.

## Migration gates
Current Render deployment remains at prior static build; no V13.5 deployment. To promote safely, audit all link paths (`account.html`, `merchant-portal.html`, staff and Tester), run real Shop A/B signed-jwt negative QA, approve roll-forward/backout and only then deploy staging. Production has separate approval.
