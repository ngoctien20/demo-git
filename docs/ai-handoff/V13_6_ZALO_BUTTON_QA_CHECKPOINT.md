# TIEN404 AI — V13.6 Zalo Button Capability Lab Checkpoint

**Date:** 2026-11-15 JST. **Release state:** EXPERIMENTAL / no send / NOT production-ready.

## 1. Work request

After Owner verified actual Zalo desktop rendering of three fixed T1–T3 QA messages, Owner asked: "được tiếp tục triển khai nút". Main product is TIEN404 AI Sales SaaS, not a Zalo-Bot-only product. **Lite** receives managed standard menus, **Plus** gets staff-managed customized Bot, **Enterprise** may integrate Zalo OA with correctly authorized interactive features. AI Studio is preserved for future work; customer accounts do not directly configure Bots.

## 2. VERIFIED current system

- Previous Bot Creator test: T1 numbered text, T2 Rich Text, T3 Markdown were **API_ACCEPTED and visually observed in Zalo desktop** by Owner. This proves formatted **text**, NOT native buttons or click callbacks. The prior 3-message send quota is fully exhausted.
- Current Cloudflare staging Worker `tien404-zalo-outbound-v1-staging`: version `21b0580c-a76d-4331-bacf-d959e289da6d`, 6 existing bindings preserved, `ZALO_SEND_ENABLED=false` confirmed via read-only API in this session. No settings changed.
- Previous manual n8n sender `qWMu4n1wLkTZBNpI` is inactive; all three `Send T1/T2/T3` nodes remain disabled. No workflow modifications or sends in V13.6.
- Official Bot `sendMessage`: https://docs.zaloplatforms.com/docs/BOT/apis/sendMessage provides text, parse_mode and text_styles but NO native button markup or click/callback schema.
- Zalo Bot overview https://docs.zaloplatforms.com/docs/BOT mentions buttons/quick reply/carousel at high level, however the public documented Bot API is insufficient to construct valid Bot button payloads. Unofficial SDK `setChatKeyboard` claims do not prove Zalo provider authorization or behavior.
- Zalo OA https://oa.zaloapp.com/home/function/interaction?type=menu-chatbot DOES document menu and CTA interactive components, but this is a different provider product. No verified Zalo OA API token/permissions or authenticated OA webhook integration was available for this Bot QA project.

## 3. IMPLEMENTED in GitHub only

Repository: https://github.com/ngoctien20/demo-git
Branch: `work/v136-zalo-button-capability-lab-staging`
Draft PR: https://github.com/ngoctien20/demo-git/pull/79
Base: `work/v135-zalo-shopb-3message-gate-staging` / PR #77, without merging earlier PRs or writing into gh-pages.

- `qa/zalo-control-text/button-capability.cjs`: shared action IDs and role-safe, provider-neutral menu from the existing `qa/sales-lite/v131/menu-registry.json` / `menu-engine.cjs` (six CUSTOMER choices). Bot Creator = `TEXT_NUMBERED`, OA = `NATIVE_BUTTONS_PREVIEW_ONLY`. Provider-native sends disabled and all provider payloads null.
- `qa/zalo-control-text/button-capability.test.cjs`: 18 source/negative tests including permission denial, role spoof, user-controlled callbacks, draft actions, no Orders writes.
- `qa/zalo-control-text/button-lab/index.html` and `app.js`: mobile-first interactive **browser QA** with clickable simulation buttons, role CUSTOMER only, uses GET-only exact V13.1 registry, DOM textContent (no HTML injection) and disabled state for unsafe registry.
- `qa/zalo-control-text/button-lab-browser-qa.cjs`: Chromium responsive tests 360/390/430/768/1280, click read-only vs draft-only, no non-GET writes, invalid registry rejects.
- `.github/workflows/v136-zalo-button-lab-qa.yml`: Node 22 and Playwright Chromium QA jobs.
- `qa/zalo-control-text/button-lab/README.md`: capability comparison, safe local preview instructions.
- `docs/ai-handoff/V13_6_ZALO_BUTTON_PROVIDER_QUESTIONS.md`: drafted official technical questions, **not sent**.

All changes are source / preview only. No Cloudflare Workers, n8n, Supabase, Render, live Zalo account, credential, billing or production changes.

## 4. TESTED evidence

- Source/negative CI run https://github.com/ngoctien20/demo-git/actions/runs/43687273605 at tested SHA `931590197f7ebe0f9ad5da77cbe1e27f25b9ae92`:
  - **18/18** V13.6 provider-neutral button tests.
  - **14/14** existing Rich Text tests.
  - **16/16** existing three-case staging Worker safety tests.
  - **116/116** V13.1 menu-engine regression tests.
  - **164/164 total PASS**.
  - Browser: five widths + one tampered-registry test PASS; no unexpected write requests, page errors, or horizontal overflow.
- Screenshot artifact (mock interface, not Zalo): https://github.com/ngoctien20/demo-git/actions/runs/43687273605/artifacts/14150309727.
- After opening PR #79, existing previously approved T1–T3 QA and button CI workflows also ran independently; these jobs contain tests only and DO NOT resend T1–T3.

## 5. BLOCKED gates

1. **Bot Creator native clickable buttons** remain **UNVERIFIED**; require exact official Bot write-endpoint/message payload + signed callback/event schema and account capabilities. Do not reuse `oa.query.show` or `oa.open.url` on Bot Creator.
2. OA real buttons require a separate Zalo OA account, validated API scope, owner approval, compliant messaging context, and correctly verified webhook; not yet configured.
3. Neither QA mock clicks nor preview action resolution may grant shop/tenant/staff permissions. Actual routing through trusted tenant resolver and AI Sales Core must be separately reviewed and tested.
4. No new Zalo sends authorized under previous three-message quota; that approval is exhausted and Worker global sending stays OFF. New live provider-native button tests require a different bounded approval **after** official schema is verified.
5. Mobile Zalo button rendering and callback end-to-end are UNTESTED, unlike previous desktop formatted-text results.

## 6. QA/rollback and next steps

- Keep GitHub PR #79 **DRAFT**, do not merge to gh-pages or release Bot Core.
- Next safe work: obtain official Zalo Bot keyboard/button/callback schema from Zalo Developer Support; if unavailable, choose Enterprise Zalo OA path with verified contract and permissions. Product should always retain Bot text-number fallback and shared Sales Core action IDs.
- Rollback: close/revert PR #79, leaving previous V13.5 Worker version `21b0580c`, D1 claims, disabled sender, webhook and credentials untouched. No database rollback needed.

**Status:** IMPLEMENTED + TESTED source and Chromium button mock. **Not yet a working native button inside Zalo Bot Creator.**

## 7. Owner follow-up "được hãy thử" — direct native-button feasibility audit (2026-11-15 JST)

The Owner asked to try native buttons following PR #79. **This was a read-only feasibility and safety preflight only; NO additional provider message was sent.**

- **VERIFIED official Bot API** https://docs.zaloplatforms.com/docs/BOT/apis/sendMessage (build 2026-08-06 09:57:04 +07) defines ONLY `chat_id`, `text`, `parse_mode`, `text_styles`. Navigation lists other text/photo/sticker/voice/chat-action and webhook endpoints, but not a documented keyboard/button write endpoint or its callback schema.
- **VERIFIED Bot overview** https://docs.zaloplatforms.com/docs/BOT still describes button, quick reply and carousel features at a high level; does NOT provide an implementable button request / callback wire contract.
- **INDEPENDENT non-authoritative sources:** community SDK repository `KaiyoDev/zalo-bot-js` lists `setChatKeyboard` and `deleteChatKeyboard` but those names are not in the official reference. Do NOT send guessed writes or treat a community SDK as proof of allowed provider support.
- **VERIFIED connected user's OA Manager tab, read-only:** URL `https://oa.zalo.me/manage/register?oasrc=oam_manage` shows a TIEN404 OA **creation form not yet completed**: business-registration and profile steps pending, required brand materials still missing. Therefore there is **no demonstrated approved OA/API credential/entitlement** for an actual button send. No forms were submitted or account state changed.
- **VERIFIED Cloudflare Worker settings, read-only:** `tien404-zalo-outbound-v1-staging` current version `21b0580c-a76d-4331-bacf-d959e289da6d`; `ZALO_SEND_ENABLED=false`, six existing bindings; no updates, deployment or sends.
- **VERIFIED n8n:** manual sender `qWMu4n1wLkTZBNpI` remains inactive, all three T1/T2/T3 sends disabled; all previously approved case slots consumed. Active Zalo ingress `yIJk8LvJoLF40Z62` and private router `sIPs6egzIwOY1GNv` have not been changed.

**Acceptance outcome:** Real Zalo Bot Creator native-button test = **BLOCKED before send**, because official protocol is not verified; OA native-button test = **BLOCKED**, because OA registration/API authorization is not complete. Browser-only simulated buttons remain TESTED, but must never be mislabeled as live Zalo buttons. New generic sends or trial-and-error guessed API writes would be outside the approved security scope.

**To unblock:** Ask Zalo Developer Support for a verified Bot keyboard/button method + event callback specification, OR finish TIEN404 OA setup/verification and obtain OA messaging permissions, then build a separate OA adapter with controlled 1-shot QA approval. No new credentials, live API sends or permissions changed in this follow-up.
