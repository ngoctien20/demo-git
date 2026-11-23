import { defineConfig } from 'vitest/config';
import { cloudflareTest } from '@cloudflare/vitest-plugin';

// NO CLOUDFLARE ACCOUNT ACCESS: the Miniflare SQLite Durable Object binding
// is created only inside the local workerd test process, never hosted.
export default defineConfig({
  plugins: [
    cloudflareTest({
      main: '../worker-v1855-hosted-entry.mjs',
      miniflare: {
        durableObjects: {
          T404_READ_ADMISSION: { className: 'T404ReadAdmission', useSQLite: true }
        }
      }
    })
  ],
  test: {
    include: ['**/*.spec.js'],
    testTimeout: 25000
  }
});
