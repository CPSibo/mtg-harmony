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