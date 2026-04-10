// Public API — what the rest of the app can import from this feature
export { useGraveyard } from './store';
export { createGraveyardWidget } from './widget';
export { default as GraveyardButton } from './components/GraveyardButton.vue';
export { default as GraveyardWidgetComponent } from './components/GraveyardWidgetComponent.vue';
export { default as GraveyardWindow } from './components/GraveyardWindow.vue';
export type { GraveyardState } from './types';
