/**
 * V18.5.5-B3 isolated Durable Object OWNER candidate — SOURCE ONLY.
 *
 * THIS MUST NOT BE DEPLOYED WITHOUT A SEPARATE OWNER APPROVAL FOR
 * A NEW WORKER DEPLOYMENT / CLOUD RESOURCE MIGRATION.
 *
 * No public route, no webhooks, no credentials, no AI, no customer data.
 * This separate Worker would own the irreversible DO class lifecycle,
 * keeping the existing V14.4 widget gateway out of the migration.
 */
export { T404ReadAdmission } from './t404-read-admission-do.mjs';

export default {
  async fetch() {
    return new Response(JSON.stringify({
      error: 'DO_OWNER_HAS_NO_PUBLIC_ENDPOINT',
      productionReady: false
    }), {
      status: 404,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff'
      }
    });
  }
};
