import { useLocalStorage } from '~/composables/useLocalStorage';
import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { isPointerEase } from '~/composables/pointerSmoothing';
import {
  DRAG_MENU_DELAY_MS,
  isDragMenuDelay,
} from '~/features/battlefield/dragMenuDelay';
import {
  CAST_DURATION_DEFAULT,
  CAST_FLIGHT_DEFAULT,
  CAST_LANDING_DEFAULT,
  isCastDuration,
  isCastFlight,
  isCastLanding,
  type CastFlight,
  type CastLanding,
} from '~/features/castAnimation/options';
export interface AppSettings {
  /** Whether the Screen Wake Lock API is requested. */
  wakeLockEnabled: boolean;

  /** Whether to show card images. */
  imagesEnabled: boolean;

  /** Whether board cards have an outline (and its hover colour). */
  cardOutlineEnabled: boolean;

  /** Easing for drags and pans, in ms; 0 is off (#104). */
  pointerSmoothing: number;

  /** How long a dragged card hovers before the attach menu opens, in ms (#108). */
  dragMenuDelay: number;

  /** How a cast card flies onto the board (#124). */
  castFlight: CastFlight;

  /** The effect where a cast card lands (#124). */
  castLanding: CastLanding;

  /** How long a cast card's flight takes, in ms (#124). */
  castDuration: number;
}

const STORAGE_KEY = 'mtg-harmony_settings';

const defaults: AppSettings = {
  wakeLockEnabled: true,
  imagesEnabled: true,
  cardOutlineEnabled: true,
  pointerSmoothing: 0,
  dragMenuDelay: DRAG_MENU_DELAY_MS,
  castFlight: CAST_FLIGHT_DEFAULT,
  castLanding: CAST_LANDING_DEFAULT,
  castDuration: CAST_DURATION_DEFAULT,
};

export const useSettingsStore = defineStore('settings', () => {
  const wakeLockEnabled = ref<boolean>(defaults.wakeLockEnabled);
  function setWakeLockEnabled(value: boolean) {
    wakeLockEnabled.value = value;
  }

  const imagesEnabled = ref<boolean>(defaults.imagesEnabled);
  function setImagesEnabled(value: boolean) {
    imagesEnabled.value = value;
  }

  const cardOutlineEnabled = ref<boolean>(defaults.cardOutlineEnabled);
  function setCardOutlineEnabled(value: boolean) {
    cardOutlineEnabled.value = value;
  }

  const pointerSmoothing = ref<number>(defaults.pointerSmoothing);
  function setPointerSmoothing(value: number) {
    pointerSmoothing.value = value;
  }

  const dragMenuDelay = ref<number>(defaults.dragMenuDelay);
  function setDragMenuDelay(value: number) {
    dragMenuDelay.value = value;
  }

  const castFlight = ref<CastFlight>(defaults.castFlight);
  const castLanding = ref<CastLanding>(defaults.castLanding);
  const castDuration = ref<number>(defaults.castDuration);

  function reset() {
    wakeLockEnabled.value = defaults.wakeLockEnabled;
    imagesEnabled.value = defaults.imagesEnabled;
    cardOutlineEnabled.value = defaults.cardOutlineEnabled;
    pointerSmoothing.value = defaults.pointerSmoothing;
    dragMenuDelay.value = defaults.dragMenuDelay;
    castFlight.value = defaults.castFlight;
    castLanding.value = defaults.castLanding;
    castDuration.value = defaults.castDuration;
  }

  function save() {
    const { save: persist } = useLocalStorage();
    persist(STORAGE_KEY, {
      wakeLockEnabled: wakeLockEnabled.value,
      imagesEnabled: imagesEnabled.value,
      cardOutlineEnabled: cardOutlineEnabled.value,
      pointerSmoothing: pointerSmoothing.value,
      dragMenuDelay: dragMenuDelay.value,
      castFlight: castFlight.value,
      castLanding: castLanding.value,
      castDuration: castDuration.value,
    });
  }

  function load(): boolean {
    const { load: retrieve } = useLocalStorage();
    const data = retrieve<AppSettings>(STORAGE_KEY);

    if (!data) {
      return false;
    }

    if (typeof data.wakeLockEnabled === 'boolean')
      wakeLockEnabled.value = data.wakeLockEnabled;

    if (typeof data.imagesEnabled === 'boolean')
      imagesEnabled.value = data.imagesEnabled;

    if (typeof data.cardOutlineEnabled === 'boolean')
      cardOutlineEnabled.value = data.cardOutlineEnabled;

    if (isPointerEase(data.pointerSmoothing))
      pointerSmoothing.value = data.pointerSmoothing;

    if (isDragMenuDelay(data.dragMenuDelay))
      dragMenuDelay.value = data.dragMenuDelay;

    if (isCastFlight(data.castFlight)) castFlight.value = data.castFlight;
    if (isCastLanding(data.castLanding)) castLanding.value = data.castLanding;
    if (isCastDuration(data.castDuration))
      castDuration.value = data.castDuration;

    return true;
  }

  load();

  watch(
    [
      wakeLockEnabled,
      imagesEnabled,
      cardOutlineEnabled,
      pointerSmoothing,
      dragMenuDelay,
      castFlight,
      castLanding,
      castDuration,
    ],
    save,
  );

  return {
    save,
    load,
    reset,

    wakeLockEnabled,
    setWakeLockEnabled,

    imagesEnabled,
    setImagesEnabled,

    cardOutlineEnabled,
    setCardOutlineEnabled,

    pointerSmoothing,
    setPointerSmoothing,

    dragMenuDelay,
    setDragMenuDelay,

    castFlight,
    castLanding,
    castDuration,
  };
});
