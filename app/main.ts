import '@fontsource-variable/public-sans';
// A subset of mana-font: see scripts/fonts/mana.mjs (#101).
import './assets/css/mana.css';
import './assets/css/main.css';
import './assets/css/mana-overrides.css';

import { addCollection } from '@iconify/vue';
import ui from '@nuxt/ui/vue-plugin';
import { createPinia } from 'pinia';
import { createApp } from 'vue';
import App from './App.vue';
import lucide from './assets/icons/lucide.json';

// The icons ship in the bundle, so none is fetched from the Iconify API (#100).
addCollection(lucide);

createApp(App).use(createPinia()).use(ui).mount('#app');
