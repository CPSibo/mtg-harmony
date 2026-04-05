<template>
  <UApp>
    <UMain class="w-svw h-svh min-h-0">
      <NuxtPage />
    </UMain>
  </UApp>
</template>

<script setup lang="ts">
/* Layout */

useHead({
  meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
  link: [{ rel: 'icon', href: '/favicon.ico' }],
  htmlAttrs: {
    lang: 'en',
  },
});

const title = 'MTG Harmony';
const description =
  'Pull random cards and display them in a grid when playing "Discord, Lord of Disharmony".';

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description,
  ogImage: 'https://ui.nuxt.com/assets/templates/nuxt/starter-light.png',
  twitterImage: 'https://ui.nuxt.com/assets/templates/nuxt/starter-light.png',
  twitterCard: 'summary_large_image',
});
</script>
