import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { sep } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import vue from '@vitejs/plugin-vue';
import ui from '@nuxt/ui/vite';
import { defineConfig, type Plugin } from 'vite';
import { precacheList, serviceWorkerSource } from './app/pwa/serviceWorker.ts';

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

/**
 * The version and short commit shown in Settings (#168). Cloudflare Pages
 * and GitHub Actions name the commit in an environment variable; elsewhere
 * git is asked, and a build without git shows the version alone.
 */
function buildInfo() {
  const { version } = JSON.parse(
    readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
  ) as { version: string };
  let commit = process.env.CF_PAGES_COMMIT_SHA ?? process.env.GITHUB_SHA ?? '';
  if (!commit) {
    try {
      commit = execSync('git rev-parse HEAD', {
        stdio: ['ignore', 'pipe', 'ignore'],
      })
        .toString()
        .trim();
    } catch {
      // Not a git checkout.
    }
  }
  return { version, commit: commit.slice(0, 7) };
}

const { version, commit } = buildInfo();

/**
 * Emits `/version.json`, `{ version, commit }`, which open tabs poll to learn
 * that a new build is out (#206, `app/pwa/updateCheck.ts`).
 */
function versionFile(): Plugin {
  return {
    name: 'version-file',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ version, commit }),
      });
    },
  };
}

/**
 * Emits `/sw.js`, which precaches this build's app shell (#169). Its version
 * is a hash of the shell's files, so any change gives a new worker.
 */
function serviceWorker(): Plugin {
  return {
    name: 'service-worker',
    apply: 'build',
    enforce: 'post',
    generateBundle(_, bundle) {
      const publicDir = fileURLToPath(new URL('./public', import.meta.url));
      // Relative to public/, with / on every OS.
      const publicFiles = readdirSync(publicDir, { recursive: true }).map((f) =>
        String(f).split(sep).join('/'),
      );
      const files = precacheList(Object.keys(bundle), publicFiles);
      const hash = createHash('sha256');
      for (const file of files) hash.update(file);
      const html = bundle['index.html'];
      if (html?.type === 'asset') hash.update(html.source);
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: serviceWorkerSource(hash.digest('hex').slice(0, 12), files),
      });
    },
  };
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __APP_COMMIT__: JSON.stringify(commit),
  },
  plugins: [
    vue(),
    preloadFont(),
    serviceWorker(),
    versionFile(),
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
