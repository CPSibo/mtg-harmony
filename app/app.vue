<script setup lang="ts">
useHead({
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' }
  ],
  link: [
    { rel: 'icon', href: '/favicon.ico' }
  ],
  htmlAttrs: {
    lang: 'en'
  }
})

const title = 'MTG Harmony'
const description = 'Pull random cards and display them in a grid when playing "Discord, Lord of Disharmony".'

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description,
  ogImage: 'https://ui.nuxt.com/assets/templates/nuxt/starter-light.png',
  twitterImage: 'https://ui.nuxt.com/assets/templates/nuxt/starter-light.png',
  twitterCard: 'summary_large_image'
})



const toast = useToast()

const onDeckStore = useOnDeckStore()
const gridStore = useGridStore()
const historyStore = useHistoryStore()
const settingsStore = useSettingsStore()
const prefetchStore = usePrefetchStore()

onMounted(() => {
  const results = [
    onDeckStore.load(),
    gridStore.load(),
    historyStore.load(),
    settingsStore.load(),
    prefetchStore.load(),
  ]

  // Seed the prefetch queue on app start / reload.
  // The queue watcher handles ongoing refills as cards are consumed.
  if (settingsStore.prefetchEnabled) void prefetchStore.fill()

  if (results.some(r => r === true)) {
    toast.add({
      title: 'State Restored',
      description: 'Previous session loaded successfully.',
      color: 'success',
    })
  }
})
</script>

<template>
  <UApp>
    <NuxtPage />
  </UApp>
</template>
