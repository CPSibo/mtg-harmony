// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@nuxt/a11y',
    '@nuxt/hints',
    '@nuxt/test-utils',
    [
      '@pinia/nuxt',
      { autoImports: ['defineStore'] },
    ],
    '@vueuse/nuxt',
  ],

  components: [
    { path: '~/components' },
    { path: '~/features', pathPrefix: true },
  ],

  imports: {
    dirs: [
      'composables',
      'features/**',
    ]
  },

  ssr: false,

  devtools: {
    enabled: true,

    timeline: {
      enabled: true,
    },
  },

  app: {
    baseURL: '/',
    head: {
      script: [
        {
          // crypto.randomUUID is only available in secure contexts (HTTPS).
          // This synchronous classic script runs before any ES-module code, so
          // it patches the function globally before @nuxt/a11y and other modules
          // call it at plugin-init time (plain HTTP, e.g. a local dev server
          // accessed from a mobile device).
          innerHTML: `if(typeof crypto!=="undefined"&&typeof crypto.randomUUID!=="function"){crypto.randomUUID=function(){var b=new Uint8Array(16);crypto.getRandomValues(b);b[6]=b[6]&15|64;b[8]=b[8]&63|128;return[...b].map(function(x,i){return([4,6,8,10].indexOf(i)>=0?"-":"")+x.toString(16).padStart(2,"0")}).join("")}}`,
        },
      ],
    },
  },

  css: [
    '~/assets/css/main.css',
    'mana-font/css/mana.css',
    '~/assets/css/mana-overrides.css',
  ],

  router: {
    options: {
      hashMode: false,
    },
  },

  routeRules: {
    '/': { prerender: true },
  },

  compatibilityDate: '2025-01-15',

  vite: {
    css: {
      preprocessorMaxWorkers: true,
    },
    optimizeDeps: {
      include: ['@vue/devtools-core', '@vue/devtools-kit', 'uuid', 'flatted'],
    },
  },
});
