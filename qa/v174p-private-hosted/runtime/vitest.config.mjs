import {cloudflareTest} from '@cloudflare/vitest-plugin';
import {defineConfig} from 'vitest/config';
export default defineConfig({
 plugins:[cloudflareTest({wrangler:{configPath:'./wrangler.jsonc'}})],
 test:{include:['tests/*.runtime.test.mjs'],testTimeout:25000,hookTimeout:25000}
});
