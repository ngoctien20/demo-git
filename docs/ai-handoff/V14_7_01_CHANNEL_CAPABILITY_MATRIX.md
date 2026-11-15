# TIEN404 V14.7-01 — Channel Capability Audit

**Date:** 2026-11-16 JST. **Scope:** Official public API documentation only, no account-level permissions or live provider sends. This evidence is a conservative capability snapshot, NOT a license or live certification.

## Labels

- DOCUMENTED_NOT_TESTED = official public documentation shows an API form, but current TIEN404 provider connection was not exercised for it.
- ACCOUNT_PERMISSION_REQUIRED = dependent on provider product, account entitlement, token scope or approval; not demonstrated on TIEN404.
- UNKNOWN = the inspected official endpoint does not substantiate this UI primitive. **UNKNOWN does not mean impossible**.
- SOURCE_PREVIEW_ONLY = TIEN404's own HTML offline visual preview, not an external provider capability.
- VERIFIED_SUPPORTED must be reserved for a valid provider test + account-specific authorized evidence; **none newly assigned here**.

## Conservative capability matrix

| Feature | Messenger Page | Zalo Bot API | Zalo OA | TIEN404 Web Widget |
| --- | --- | --- | --- | --- |
| Text | DOCUMENTED_NOT_TESTED | DOCUMENTED_NOT_TESTED | ACCOUNT_PERMISSION_REQUIRED | SOURCE_PREVIEW_ONLY |
| Image | DOCUMENTED_NOT_TESTED | DOCUMENTED_NOT_TESTED | ACCOUNT_PERMISSION_REQUIRED | SOURCE_PREVIEW_ONLY |
| Generic product carousel | DOCUMENTED_NOT_TESTED | UNKNOWN | UNKNOWN | SOURCE_PREVIEW_ONLY |
| Quick replies | DOCUMENTED_NOT_TESTED | UNKNOWN | UNKNOWN | SOURCE_PREVIEW_ONLY |
| Action buttons | DOCUMENTED_NOT_TESTED | UNKNOWN | ACCOUNT_PERMISSION_REQUIRED | SOURCE_PREVIEW_ONLY |
| Persistent menu | DOCUMENTED_NOT_TESTED | UNKNOWN | ACCOUNT_PERMISSION_REQUIRED | SOURCE_PREVIEW_ONLY |
| Rich text style | UNKNOWN | DOCUMENTED_NOT_TESTED | UNKNOWN | SOURCE_PREVIEW_ONLY |
| Webview / OA widget | ACCOUNT_PERMISSION_REQUIRED | UNKNOWN | ACCOUNT_PERMISSION_REQUIRED | SOURCE_PREVIEW_ONLY |
| Staff handoff | ACCOUNT_PERMISSION_REQUIRED | UNKNOWN | ACCOUNT_PERMISSION_REQUIRED | SOURCE_PREVIEW_ONLY |

## Source evidence

1. Messenger Quick Start, generic template with title/image/subtitle/buttons, Page-scoped PSID and role-gated app review:
   https://developers.facebook.com/docs/messenger-platform/getting-started/quick-start
2. Messenger Graph API Page Messages v27.0: sender action, quick replies, attachments/templates and DISPLAY_PERSISTENT_MENU reference; authorization still unverified:
   https://developers.facebook.com/docs/graph-api/reference/page/messages
3. Zalo Bot sendMessage: text length 1–2,000; parse_mode markdown/html; text_styles with fixed allowed codes; parses one formatting mode at a time:
   https://docs.zaloplatforms.com/docs/BOT/apis/sendMessage
4. Zalo Bot sendPhoto: photo URL, caption 1–2,000 characters when supplied:
   https://docs.zaloplatforms.com/docs/BOT/apis/sendPhoto
5. Zalo Official Account documentation product index: OA messaging and separate ZBS Template Message systems. Product categories do not prove any specific current account entitlement:
   https://developers.zalo.me/docs/
6. Zalo OA Social Chat Widget: data-oaid, welcome text, popup and width/height for the developer-supplied web embed; this is **not Zalo Bot API**:
   https://developers.zalo.me/docs/social/zalo-chat-widget

## Design consequences

- Messenger generic template/quick-reply cards in this release are **mock visuals**, not actual Send API payloads.
- Zalo Bot output is text with numbered actions. Rich Text and image have documented API forms but remain not tested on the current Bot credential. No unproven native carousel or button is sent.
- Zalo OA is a separate experience; CTA, menus, templates require capability and entitlement validation. ZBS template creation or paid send requires explicit approval and spend gate.
- Web Widget can be styled independently because TIEN404 owns its preview UI; it cannot adopt provider-native permissions or authorize personal Order lookup merely from Origin/Widget ID.
- The source-only preview does not fetch any external image or call AI, Meta, Zalo, n8n, Supabase or Cloudflare. Store-specific sample prices and inventory are not actual merchant facts.
- Capability evidence dates and API versions should be refreshed before any real provider pilot.

## Next independent verification

Messenger: authorized QA Page, real Page→Store identity, verified signature, app tester permissions and tiny bounded real send (only with separate approval).

Zalo Bot: trusted `getMe` identity and owner binding; authorized read-only capability check; no real send until owner approval.

Zalo OA: documented required account/OA scopes, templating policy, cost, approved account capability; no simulated OA design should be claimed provider-ready.
