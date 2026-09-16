import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [swc.vite()],
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    // Random order proves the tests do not depend on each other; the seed is printed on failure.
    sequence: { shuffle: true },
  },
});
