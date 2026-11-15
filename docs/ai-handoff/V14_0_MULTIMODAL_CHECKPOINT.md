# TIEN404 AI V14.0 — Multimodal Image-to-SKU Checkpoint
Date: 2026-11-15 JST | Classification: EXPERIMENTAL / STAGING / DRAFT / NO CUSTOMER DATA

## Verified predecessor baseline
- V13.6 PR #79 OPEN DRAFT; head 52e9072963b9f6e2096bcf359f5701d9432c6a3f.
- V13.7 PR #80 OPEN DRAFT; head 61126b9da568cf6d18323319b0d99ab8354d8d73.
- V13.8 PR #82 OPEN DRAFT; head 064b106868824985d50fb43c0e105be1cf9c7f4a, which is V14's chosen base. No merge.
- n8n protected Zalo ingress yIJk8LvJoLF40Z62 active v8ca4a6f6-ab3f-42f1-8637-d4f5db790a3e, text-only; unchanged.
- n8n private customer router sIPs6egzIwOY1GNv active v8d91d23c-cd87-462f-a112-9cca2340bec8; uses QA catalogue; unchanged.
- n8n Shop B dialogue 3827 SUCCESS 20/20; handoff 3829 SUCCESS 19/19. Neither is a real customer-image test.
- Supabase staging ifxlvrhyjhbzbrkdsida: public.products, public.conversations and public.messages have tenant_id but **no store_id**; current SELECT policies scope by tenant. Existing QA catalog tien404_r1_qa.catalog is store scoped and synthetic only. storage.buckets returned zero rows.
- Supabase security advisor reported an existing anon-executable SECURITY DEFINER public function (qa_shop_b_zalo_claim). Do NOT change policies without a separate privileged security review.
- Cloudflare staging Worker tien404-zalo-outbound-v1-staging last readback: latest deployment 2ce7ea81-3755-47b1-afdd-a799db3da3c8, version ed172d3c-e1f1-4daa-bc56-643406441091. ZALO_SEND_ENABLED=false verified through Worker binding settings; no Worker changes.

## V14 implemented
- `qa/multimodal-v14/core.cjs`: pure offline normalization, media URL policy preflight, QA fixture vision-result schema, catalog scope guard, verified exact SKU vs similar suggestions, Vietnamese non-sending reply preview.
- `qa/multimodal-v14/core.test.cjs`: positive and negative Node tests including spoofed ingress, groups, self-bot, duplicates, SSRF-like URL shapes, cross-shop/cross-tenant, invalid money, unknown SKU, stale price and OCR prompt-injection text.
- `qa/multimodal-v14/n8n-manual-qa-snapshot.json`: sanitized snapshot of independent new manual QA workflow.
- `TIEN404_MULTIMODAL_INGRESS_V14_STAGING` n8n ID `9UDajs5gyaasf6XN`, Personal / 90_QA - DIAGNOSTICS, inactive v`35d84a17-4945-4b79-bb92-1719c34e9911`; no external I/O or credentials.

## QA evidence
- n8n 3830 ERROR due to `URL` class unavailable in the n8n Code sandbox; this was a QA-only implementation issue, not a customer defect.
- n8n 3831 SUCCESS, `V14_OFFLINE_IMAGE_TO_SKU_CONTRACT_SMOKE` 11/11; external sends 0, model calls 0, media downloads 0, Orders writes 0.
- Node source tests are provided; GitHub Actions must be inspected before marking their CI TESTED.
- These 11 tests operate on synthetic metadata, not image bytes. **Vision image accuracy, Top-3 recall, real Zalo photo URL format, latency and cost are UNKNOWN**.

## Provider payload uncertainty
- Zalo Bot ecosystem references the image event name `message.image.received`. Community implementations disagree on whether the media field is `photo` or `photo_url`.
- Until TIEN404 receives an owner-authorized, sanitized live image sample or official definitive schema, do not hard-code one shape and do not claim either was verified on this Bot.
- Live Zalo Bot API and Zalo OA OpenAPI are separate channel contracts.

## Dependency / proposed architecture
A. Authenticated Zalo Webhook → Trusted server-side Bot/Tenant/Store resolver → idempotency key (atomic persistence), no tenant from customer JSON.
B. Secure egress media proxy: HTTPS hostname allowlist, DNS/IP revalidation each redirect, maximum bytes/timeout, magic-byte MIME check, no raw URL logging, short retention.
C. Vision adapter: paid model behind explicit budget cap, typed JSON, prompt injection isolation, model/prompt version, no direct SKU/price authority.
D. Store-restricted catalogue: exact SKU must match a canonical record; attributes only produce candidates until confirmed; price/stock read back at reply/order confirmation.
E. Conversation preview and staff handoff; Outbox real-send disabled until owner approval.

## Product-image registry — proposal only, no migration
- Add store entity/key and store membership first; verify corresponding Auth/RLS via Shop A and Shop B hosted sessions.
- Extend canonical `public.products` with store binding (or use a verified product/store mapping table) **only after schema review**.
- Proposed `product_images` attributes: id, tenant_id, store_id, product_id, bucket_id, storage_path, image_sha256, role(primary/front/back/detail), variant metadata, mime_type, byte_size, created_at.
- Private Storage bucket with allowed MIME, max file size, tenant/store RLS for upload/read; images kept outside SQL bytes, use short-lived signed URLs; no public bucket for customer media.
- FK and unique constraints must enforce (tenant_id, store_id, product_id), not just a tenant claim. Actual migration SQL and rollback will be drafted after product/store schema is approved.

## P0 gates
1. No store_id RLS for public.products/conversations/messages: cross-shop exposure risk if same tenant has >1 store.
2. No trusted secure media downloader, no real image payload verified.
3. No live Vision adapter or per-image quota/cost measurement.
4. No persistent atomic dedup and private media retention mechanism.
5. Existing Supabase advisor exposed SECURITY DEFINER function needs independent review before public go-live.

## Change log and rollback
- Existing n8n, Cloudflare, Supabase, Render and production unchanged by this V14 increment.
- New GitHub draft branch created from PR82 head, only additive QA files.
- New n8n inactive manual workflow; snapshot version listed above. To rollback, close/revert V14 Draft PR and optionally archive only this new workflow after owner approval. No customer data to restore.
- DO NOT activate new workflow, wire webhook, merge draft, run real AI model, modify RLS/credential, create Storage bucket or enable outgoing Zalo without separate approval.

## Outstanding roadmap
- Phase B offline source/contract: IMPLEMENTED, targeted smoke TESTED
- Phase C true model-based Vision on real images: BLOCKED pending approval, reference fixtures, credentials/paid budget
- Phase D offline matching: IMPLEMENTED, CI status pending
- Phase E V13.8 integration: PROPOSED (preview only)
- Phase F Staff UI: PROPOSED
- Phase G hosted RLS/real-media negative QA: BLOCKED
- Phase H Draft PR: pending PR creation
