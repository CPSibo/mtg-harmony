// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@nuxt/a11y',
    //'@nuxt/hints',
    '@nuxt/test-utils',
    '@nuxtjs/eslint-module',
    '@pinia/nuxt',
    '@vueuse/nuxt'
  ],

  imports: {
    dirs: ['stores'],
  },

  components: {
    dirs: ['~/components'],
  },

  devtools: {
    enabled: true
  },

  ssr: false,

  css: [
    '~/assets/css/main.css',
    'mana-font/css/mana.css',
    'keyrune/css/keyrune.css',
  ],

  routeRules: {
    '/': { prerender: true }
  },

  app: {
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

  compatibilityDate: '2025-01-15',

  vite: {
    optimizeDeps: {
      include: [
        '@vue/devtools-core',
        '@vue/devtools-kit',
      ]
    }
  }
})