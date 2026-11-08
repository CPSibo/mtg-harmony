import { fileURLToPath, URL } from 'node:url';
import vue from '@vitejs/plugin-vue';
import ui from '@nuxt/ui/vite';
import { defineConfig, type Plugin } from 'vite';

/**
 * Preloads the Latin Public Sans font. Otherwise the browser only finds it
 * after parsing the CSS, and text renders in the fallback font until then.
 * The file name is hashed, so it's added at build time.
 */
function preloadFont(): Plugin {
  return {
    name: 'preload-font',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(_, { bundle }) {
        const font = Object.keys(bundle ?? {}).find((file) =>
          /public-sans-latin-wght-normal-.*\.woff2$/.test(file),
        );
        if (!font) throw new Error('preload-font: Public Sans not in bundle');
        return [
          {
            tag: 'link',
            attrs: {
              rel: 'preload',
              href: `/${font}`,
              as: 'font',
              type: 'font/woff2',
              crossorigin: '',
            },
            injectTo: 'head',
          },
        ];
      },
    },
  };
}

export default defineConfig({
  plugins: [
    vue(),
    preloadFont(),
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
