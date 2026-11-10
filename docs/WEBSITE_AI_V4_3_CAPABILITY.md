# TIEN404 Website AI V4.3 — Capability Training

## Scope
Website consultant bot only. The published workflow remains unchanged; draft is a 7-node QA-isolated workflow. No order/customer credentials or sales tools are attached.

## Architecture
Chat Trigger → Validate input and quotas → IF allowed → Website Knowledge Router V1 (curated intent-matched facts) → OpenAI response → Format reply. Rejected requests go to quota response.

## Knowledge router
Routes questions into: core product, pricing/plans, integrations, orders/payment, security/privacy, trial/lead, and risks/human handoff. It injects up to four verified knowledge snippets into the system message. This is a **draft embedded knowledge source**, not a live synchronized external knowledge base. Keep source-of-truth versioning and review before updates.

## Current limitations
- No conversation memory across turns. Chat Trigger uses loadPreviousSession=notSupported.
- Quotas are low (6 messages/session and 30/day), static workflow data may not provide robust distributed rate limiting.
- No live web search or verified dynamic price lookup; cannot answer real-time prices or news accurately.
- No handoff, lead capture, CRM, or order actions.
- The public widget is not verified end-to-end.
- QA runner and CI are not yet connected; 30-case fixture file is for human/automated evaluation development.

## Release gate
Run every case in `data/website-ai-capability-qa-v4-3.json` in isolated manual mode, capture execution IDs and outputs, review factual accuracy, hallucination, safety, tone, fallback, prompt injection, rate limiting, mobile widget, multi-turn; require zero critical failures. Obtain explicit owner approval before publishing.
