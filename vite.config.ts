import { fileURLToPath, URL } from 'node:url';
import vue from '@vitejs/plugin-vue';
import ui from '@nuxt/ui/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    vue(),
    ui({
      // Single-page app: no vue-router, so links render as plain <a>.
      router: false,
      // Everything is imported explicitly; no generated auto-import files.
      autoImport: false,
      components: false,
      // Theme CSS only for the components the app imports, not all ~125:
      // about 100 kB less CSS.
      experimental: { componentDetection: true },
      ui: {
        colors: {
          primary: 'fuchsia',
          neutral: 'zinc',
        },
      },
    }),
  ],
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('./app', import.meta.url)),
    },
  },
});
