// Entry for the separate Worker "tien404-setup-draft" (does not touch existing Workers).
import { setupDraftRoute } from './setup-route.mjs';

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    const res = await setupDraftRoute(request, env, path);
    return res ?? new Response('Not found', { status: 404, headers: { 'cache-control': 'no-store' } });
  },
};
