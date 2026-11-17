import {cloudflareTest} from '@cloudflare/vitest-plugin';
import {defineConfig} from 'vitest/config';

// Local-only Cloudflare Workers Vitest integration. NEVER deploy.
export default defineConfig({
  plugins:[cloudflareTest({wrangler:{configPath:'./qa/v1721-zalo-durable/wrangler.local.jsonc'}})],
  test:{include:['qa/v1721-zalo-durable/zalo-bot-replay-v2.cf.test.mjs'],testTimeout:25000,hookTimeout:25000}
});
