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
import { registerServiceWorker } from './pwa/register';
import lucide from './assets/icons/lucide.json';
import { showStartupFailure } from './startupRecovery';

// The icons ship in the bundle, so none is fetched from the Iconify API (#100).
addCollection(lucide);

const app = createApp(App).use(createPinia()).use(ui);

// A store that can't read its saved data throws while the app starts. Show
// a way out instead of a blank page (#154). Errors after startup are only
// logged, as Vue would.
let started = false;
app.config.errorHandler = (error, _instance, info) => {
  console.error(error, info);
  if (!started) showStartupFailure(error);
};
try {
  app.mount('#app');
} catch (error) {
  console.error(error);
  showStartupFailure(error);
}
started = true;
registerServiceWorker();
