# TIEN404 SALES LITE V1.3 — Commercial Unit Economics (ILLUSTRATIVE, NOT LIVE PRICING)

Date: 2026-11-15 JST. Commercial gate: PROPOSED / NOT APPROVED.
Product hypothesis: Sales Lite 199,000 VND/shop/month; Sales Lite Plus 349,000 VND/shop/month. These have not been published to Billing.

## 1. Calculation contract

Monthly provisional contribution per shop =
  plan_revenue - AI_calls * unit_AI_cost - support_minutes * support_cost_per_minute
  - allocated_infrastructure - processing_fee - verified_provider_cost
  - onboarding_amortization - other_direct_cost.

Do NOT call this net profit or confirmed gross margin. Until Zalo provider rates/limits, actual AI usage, n8n/Supabase/Cloudflare bills, support time, taxes, CAC and onboarding are measured, final per-shop profit is **UNKNOWN**. No automatic customer charges or billing writes.

## 2. Scenario inputs — ALL VALUES ARE ASSUMPTIONS

| Driver | Low Usage | Standard Usage | High Usage |
|---|---:|---:|---:|
| Customers messaging / shop / month | 60 | 250 | 900 |
| Inbound+outbound conversation turns | 300 | 1,500 | 6,000 |
| Paid AI inference calls | 60 | 400 | 2,000 |
| Order requests (not paid orders) | 20 | 75 | 280 |
| Owner notifications required | 20 | 75 | 280 |
| Merchant support minutes | 10 | 30 | 90 |
| Allocated infrastructure VND/shop/month (assumption) | 25,000 | 35,000 | 65,000 |

Additional purely illustrative cost assumptions:
- 30 VND/paid AI call blended (not actual token/model quote).
- 600 VND/minute human support direct cost.
- 2% collected plan revenue as payment processing cost assumption, **not contracted payment fee**.
- Zalo Bot provider cost/quota: UNKNOWN (not set to zero).
- One-time onboarding time/cost, QA incident handling, taxes, CAC, refunds, legal overhead: UNKNOWN/excluded.

## 3. Preliminary sensitivity — exclude UNKNOWN expenses

| Scenario | Lite revenue | Known-assumption example cost* | Lite provisional surplus* | Plus revenue | Plus provisional surplus* |
|---|---:|---:|---:|---:|---:|
| Low | 199,000 | 36,780 | 162,220 | 349,000 | 309,220 |
| Standard | 199,000 | 68,980 | 130,020 | 349,000 | 277,020 |
| High | 199,000 | 182,980 | 16,020 | 349,000 | 163,020 |

*These are **hypothetical numeric demonstrations**, not actual costs or profit; provider messaging, onboarding, CAC, taxes, legal, refunds, SLA and other unknown expenses are excluded. Plus processing fee is 6,980 vs Lite 3,980, so Plus column uses a different assumed cost base (Low 39,780; Standard 71,980; High 185,980).

Interpretation: at High usage, a Lite plan has a very small hypothetical cost headroom **before** Zalo provider charges and excluded costs. It is risky to sell unlimited AI or unlimited support on 199k without hard quotas, usage metering and provider commercial approval.

## 4. Decision criteria

- Document authorized Zalo Bot commercial use, messaging constraints, rate limits and fees from provider.
- Measure real cost per AI call (model/long context/tools), number of turns, failed attempts, human support minutes, infrastructure bills, payment fees, refunds and onboarding time for at least a pilot cohort.
- Meter usage per tenant/store with hard per-shop limits, especially model calls and outbound notifications.
- Proposed product boundaries (not activated): Lite for low/simple operations with text menu and reasonable usage cap; Plus for greater volume/assisted setup and support. Final limits require actual evidence.
- Never label request_count as paid_orders or treat unconfirmed revenue as paid revenue.
- Obtain Owner approval for pricing, quotas, Billing and customer-facing terms.

## 5. Exposure gates

No new Zalo Bot API sends, paid inference calls, provider accounts, paid services, invoice generation or plan changes were performed in V13.3. Unit economics remains **PROPOSED** and must not be used as a financial forecast or promise.
