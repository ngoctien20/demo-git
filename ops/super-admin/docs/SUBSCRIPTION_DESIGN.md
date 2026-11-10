# TIEN404 AI V4 — SUBSCRIPTION_DESIGN

**Reference lifecycle implemented and tested in local staging; not connected to a payment gateway.**

## Source of truth

Plans (`plan_id`, `label`, `price_minor` as integer VND, `cycle`, `max_messages`, `grace_days`) are created by SUPER_ADMIN, not hardcoded as commercial catalog. No user-approved Basic/Pro/Business prices are available yet. Trial and paid states are isolated per tenant; plan assignment is NOT a payment confirmation.

### State machine

```text
FREE_TRIAL --trial ends--> EXPIRED
PAYMENT_DUE (first invoice, NEVER paid) --signed payment--> ACTIVE
ACTIVE --renewal due--> PAYMENT_DUE --grace running--> PAST_DUE
PAYMENT_DUE/PAST_DUE --grace passed--> SUSPENDED
ACTIVE/PAYMENT_DUE/PAST_DUE/SUSPENDED/EXPIRED --verified paid event--> ACTIVE
CANCELLED --manual re-enrollment review required--> (not automated)
```

- **Active entitlement:** `FREE_TRIAL` before trial expiry; `ACTIVE` before renewal; or previously paid `PAYMENT_DUE/PAST_DUE` until grace end.
- **Fail-closed:** first unpaid invoice, expired trial, suspended, cancelled, expired, disabled service, paused bot, unknown tenant, unknown/unverified channel => no paid AI service.
- Granting a grace window **must require a previously verified payment**, not merely an administrator assigning a paid plan. This was discovered and corrected in staging tests.
- Deny immediately at the entitlement gateway if the entitlement is no longer valid even when background scheduling is unavailable.
- Keep subscription state, tenant service flag, store open/closed state and channel status independent; never turn off an n8n shared workflow.

## Payment handling

- No real payment provider has been chosen or connected.
- The test endpoint uses an explicit *sandbox HMAC protocol*; it is disabled without staging-specific configuration and is not compatible with any payment processor's production signature format.
- It requires signature, timestamp within 5 minutes, correct currency/amount, tenant + subscription match, and unique `(provider,event_id)` to avoid duplicate activation. Unexpected amounts or replayed changes are rejected.
- An uploaded screenshot, text message or customer assertion cannot activate a subscription.
- Production requires provider-specific signature validation, event-level idempotency, concurrency testing and authoritative settlement/reversal handling. Manual receipt approval requires a separate two-person audited procedure and is NOT implemented.

## Mandatory work before commercial billing

1. Choose actual payment and invoicing provider; approve pricing and grace policy per plan.
2. Implement official provider verification and refund/dispute/reversal reconciliations. Never treat a client redirect as success.
3. Use true calendar-month cycles and explicit time zones; staging uses fixed 30-day/365-day periods for tests only.
4. Add notification outbox with idempotent sends, payment reminders, renewal schedule, recovery jobs, retries and observability.
5. Implement merchant/customer data retention policy; stage restore test before serving orders.
6. Perform signed event duplicate/wrong-tenant/amount tests in dedicated provider sandbox.
7. Take an operator-approved database migration + rollback checkpoint before release.

## Acceptance criteria

`subscription active` !== `workflow active` and `subscription active` !== `channel connected`. Every paid bot request is gated by tenant entitlement and channel identity; no paid service is granted from unverified payment data or unapproved pricing.