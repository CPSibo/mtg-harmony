import { fileURLToPath, URL } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';

// Test setup is minimal until #18 adds the first tests.
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('./app', import.meta.url)),
    },
  },
  test: {
    include: ['test/unit/**/*.{test,spec}.ts'],
    environment: 'node',
    coverage: {
      enabled: true,
      provider: 'v8',
    },
  },
});
