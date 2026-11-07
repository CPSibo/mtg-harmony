import '@fontsource-variable/public-sans';
import 'mana-font/css/mana.css';
import './assets/css/main.css';
import './assets/css/mana-overrides.css';

import ui from '@nuxt/ui/vue-plugin';
import { createPinia } from 'pinia';
import { createApp } from 'vue';
import App from './App.vue';

createApp(App).use(createPinia()).use(ui).mount('#app');
