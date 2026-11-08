import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';

// Reuses the app's Vite config (Vue, Nuxt UI, the ~ alias), so tests resolve
// modules the same way the app does.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      include: ['test/unit/**/*.{test,spec}.ts'],
      // Stores touch localStorage and Image, so tests default to a DOM.
      // Opt a file out with a `// @vitest-environment node` comment.
      environment: 'happy-dom',
      setupFiles: ['test/unit/setup.ts'],
      // Node 25+ ships its own global localStorage (undefined without a
      // backing file), which hides happy-dom's. Turn it off in test workers.
      execArgv: ['--no-experimental-webstorage'],
      restoreMocks: true,
      unstubGlobals: true,
      coverage: {
        enabled: true,
        provider: 'v8',
        include: ['app/**/*.{ts,vue}'],
      },
    },
  }),
);
