# TIEN404 — Questions for official Zalo Developer Support (DRAFT ONLY, NOT SENT)

Product: Zalo Bot Creator, **not** Zalo OA OpenAPI / ZBS / Mini App.
TIEN404 uses a Bot already created via Bot Creator, using sendMessage/text_styles to send verified QA messages; owner wants clickable native buttons in a Bot chat.

Please confirm these points in official documentation or written technical response:

1. Is there a supported method in the **Bot Creator API** to send clickable inline buttons, quick replies, persistent keyboards, or a carousel? If yes, provide exact endpoint, request JSON schema, applicable bot account tiers, count/label limits and which Zalo desktop/mobile clients display them.
2. Is there an officially supported `setChatKeyboard` / `deleteChatKeyboard` method? These names appear in a community SDK, but are absent from the official Bot API reference currently available. Is the method supported and permitted to integrate commercially?
3. How does Bot Creator deliver the **button click** action to our configured Webhook? Please provide example callback event, unique event ID, callback_data maximum length, signature verification and replay protection.
4. Can a Bot action carry a signed, scoped selection with `tenant_id`, `store_id` or must the app resolve tenant server-side from the Bot identity? We plan to resolve all tenant scopes on our server and never trust client-supplied IDs.
5. Are Bot Creator inline buttons available to any Bot account or only certain commercial/verified tiers? Are quotas, costs or restrictions applicable?
6. If unavailable for Bot Creator, does Zalo explicitly recommend the **Zalo Official Account** menu/button API or Zalo Mini App? What OA verification and message-permission scopes are needed for read-only product consultation, order confirmation and post-sale support?
7. Which Zalo policy covers staff-managed multi-merchant SaaS Bot setup and owner notification recipients?

Do NOT put any Bot Token, chat ID, phone number, private webhook URL or user screenshots in this inquiry. Provide only generic integration details and links.

References:
- https://docs.zaloplatforms.com/docs/BOT/apis/sendMessage
- https://docs.zaloplatforms.com/docs/BOT
- https://oa.zaloapp.com/home/function/interaction?type=menu-chatbot

Release gate: UNVERIFIED BOT NATIVE BUTTONS; no trial of an undocumented write endpoint, no new real sends under the exhausted T1–T3 authorization.
