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
