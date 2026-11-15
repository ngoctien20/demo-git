# TIEN404 AI V14.0 — Offline Image-to-SKU Prototype
Status: **EXPERIMENTAL / STAGING / NO SEND / NO ORDER / NO DB WRITE / NO PAID VISION MODEL**.

## Integration boundary
1. Zalo Bot Creator webhook ingress remains active and text-only. Never wire this module directly to the protected inbound endpoint without a reviewed, server-built Bot→Tenant→Store binding.
2. `normalizeImageEvent()` accepts both `message.photo_url` and `message.photo` (provider field is **NOT verified for TIEN404's own Bot**), and wrapped/flat events. It does not download media. Header secret authentication MUST happen upstream.
3. Media retrieval is **NOT IMPLEMENTED**: use a server-controlled egress proxy with DNS/IP checks, redirect-hop allowlist, MIME/magic-byte validation, download size/timeout bounds, ephemeral private storage, and retention limits. Never call provider URL directly from an n8n Code node.
4. `verifyVisionResult()` accepts **QA fixture only**. Paid image-capable model adapter is deliberately BLOCKED until consent, image samples, budget and credentials have been approved. Synthetic attributes do not prove real vision accuracy.
5. `matchProduct()` requires **VERIFIED_STORE_CATALOG** data from a trusted resolver, rejects any foreign store/tenant records, and only marks exact SKU verified when it exists, is active and has fresh validated price/stock. Attribute matches are candidates only.
6. `previewReply()` outputs a Vietnamese, unsent customer draft. It cannot send messages, create orders or alter stock.
7. The in-memory `seenIds` guard is QA-only. Real replay defense requires an atomic persistent unique key and retention policy.
8. Image-to-SKU accuracy, latency and cost are **NOT MEASURED**. No provider, no real images, no hosted RLS test or delivery claim.

## Source of truth / existing blockers
- Supabase staging public.products, conversations and messages have tenant_id but no store_id; store-level RLS design P0 remains open.
- No Supabase Storage buckets existed at read-only audit, 15 Nov 2026.
- Existing n8n published ingress `yIJk8LvJoLF40Z62`, private router `sIPs6egzIwOY1GNv` MUST NOT be modified.
- Legacy `tien404_r1_qa.catalog` is strictly synthetic; do not mix with AI_SALES_DEMO or real Commerce.

## Test
`node --test qa/multimodal-v14/core.test.cjs` (Node 20/22).
Fixtures are synthetic and must not be reported as vision-model test.
## Rollback
Close this Draft PR / delete V14 experiment branch and optionally archive the new **inactive** V14 manual QA workflow after inspection. No existing runtime was modified.
