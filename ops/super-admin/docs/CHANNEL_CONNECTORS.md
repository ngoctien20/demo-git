# TIEN404 AI V4 — CHANNEL_CONNECTORS

**Current status:** secure connector *design* and staging metadata/tenant uniqueness checks. NO production Messenger, LINE, Zalo or Telegram credentials were created or changed in this task. No outbound messages were sent.

## Proposed adapter contract

A backend connector implements: `authorize()`, `receiveWebhook(rawHeaders, rawBody)`, `verifyProviderSignature()`, `resolveExternalAccountId()`, `mapToTenant()`, `checkEntitlement()`, `normaliseEvent()`, `emitTenantScopedEvent()`; optionally `testConnection()`, `rotate()`, `disconnect()`, and `health()`. All network calls originate at server side.

For every connection store only `{tenant_id, platform, account_ref, secret_ref, connection_status, permission_status, webhook_status, token_expiry, last_sync, last_error}`. **Never return `secret_ref` or access token to customer dashboard.** Stage database rejects mapping the same `(platform, account_ref)` to multiple tenants.

## Platform policy / verification references

| Platform | Official docs | Before enabling |
|---|---|---|
| Messenger | https://developers.facebook.com/docs/messenger-platform/ | Confirm Page ownership, Meta app permissions, review status, webhook verification + delivery signature, current policy and recipient permissions |
| LINE Messaging API | https://developers.line.biz/en/docs/messaging-api/receiving-messages/ | HTTPS webhook, validate `X-Line-Signature` against channel secret before parsing payload, channel access token and permissions; verify account ownership |
| Zalo Official Account | https://developers.zalo.me/docs/ | Confirm OA eligibility, current messaging policy, official authorization grant, webhook validation rules, app review and rate limits in applicable Zalo docs |
| Telegram Bot API | https://core.telegram.org/bots/api | Set webhook over HTTPS; configure and verify `X-Telegram-Bot-Api-Secret-Token`; verify bot identity and tenant-bound token ownership |

These are design references, not proof that approvals or public app access are already granted. OAuth scopes, review requirements and allowed message windows must be rechecked for the specific account before integration.

## Connection wizard / lifecycle (not yet built in Control Hub)

`Select tenant → choose platform → official authorization → secret-manager reference → verify provider webhook → bind unique external account → dry-run → mark VERIFIED → enable after approval`. Missing permissions, token expiry or webhook errors are surfaced as `UNKNOWN/ERROR`, not green.

OAuth where supported; manual token entry only through privileged HTTPS backend form. Store encrypted token in isolated secret store, never localStorage, GitHub, n8n public workflows, application audit bodies or logs. Rotations and revocations should invalidate cached clients. Distinguish bot token/channel token from LLM API key.

## Critical shared workflow rule

The inbound webhook adapter must verify provider signature FIRST and then resolve `(platform, external account id)` from a unique registry to tenant_id. Never accept tenant_id from incoming customer text. Call the internal entitlement gateway, enforce quotas and routing, and only then dispatch to the approved bot version. A tenant-level suspension must not unpublish a shared n8n workflow.

## Current staging tests

- Reference metadata accepts only opaque `vault://` identifiers, never raw platform tokens.
- Token references never appear in JSON responses or audit rows.
- Cross-tenant duplicate platform account mapping rejected.
- Service-to-service HMAC entitlement request requires a trusted signature, timestamp and exact schema; extra `tenant_id` is rejected.
- Unverified channel status prevents permission even when subscription exists.

**Gaps:** real OAuth, provider-specific webhook verification, retries/rate limiting, provider account ownership checks, bot activation, outgoing messaging, secrets manager, connection test, channel disconnection and signed webhook replay storage.