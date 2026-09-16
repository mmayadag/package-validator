import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';

// Same-origin API calls: Caddy proxies /v1 in Docker, Vite does it in development.
const apiProxy = { '/v1': 'http://localhost:3288' };

export default defineConfig({
  plugins: [svelte()],
  server: { proxy: apiProxy },
  preview: { proxy: apiProxy },
  test: {
    include: ['src/**/*.spec.ts'],
  },
});
