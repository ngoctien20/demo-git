/**
 * V16.1 Worker entrypoint — SOURCE-ONLY, NO CLOUDFLARE DEPLOYMENT CONFIG.
 * Exposes ONLY /__qa/v16/event with a synthetic QA HMAC; all production
 * Messenger/Zalo/Website routes return 404. Never sends a provider message,
 * never calls a paid AI API, never executes an Order / Supabase RPC.
 *
 * Do NOT attach live Cloudflare bindings or real customer payloads.
 */
import {handleQaFetch,handleQaBatch} from './hybrid-core.mjs';
export default {
 async fetch(request,env){return handleQaFetch(request,env)},
 async queue(batch,env){await handleQaBatch(batch,env)}
};
