/* One shared Supabase Auth client; public publishable key only.
 * External CDN modules are explicitly bounded and have an independent fallback.
 */
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './auth-config.js';
import { withDeadline } from './auth-runtime.mjs';

let currentClient = null;
let currentLoad = null;
const sources = [
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0/+esm',
  'https://esm.sh/@supabase/supabase-js@2.119.0?bundle'
];
export function getAuthClient() {
  if (currentClient) return Promise.resolve(currentClient);
  if (currentLoad) return currentLoad;
  currentLoad = (async () => {
    let lastError;
    for (const url of sources) {
      try {
        const sdk = await withDeadline(import(url), 9000, 'AUTH_SDK_TIMEOUT');
        if (typeof sdk.createClient !== 'function') throw new Error('INVALID_AUTH_SDK');
        currentClient = sdk.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          auth: {persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'pkce'}
        });
        return currentClient;
      } catch (error) {
        lastError = error;
        // Do not log URL-specific auth details or any user data.
      }
    }
    throw Object.assign(new Error('AUTH_SDK_UNAVAILABLE'), {code:'AUTH_SDK_UNAVAILABLE',cause:lastError});
  })().catch(error => {currentLoad=null;throw error});
  return currentLoad;
}
