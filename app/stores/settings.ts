import { useLocalStorage } from '~/composables/useLocalStorage';
import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { isPointerEase } from '~/composables/pointerSmoothing';
export interface AppSettings {
  /** Whether the Screen Wake Lock API is requested. */
  wakeLockEnabled: boolean;

  /** Whether to show card images. */
  imagesEnabled: boolean;

  /** Whether board cards have an outline (and its hover colour). */
  cardOutlineEnabled: boolean;

  /** Easing for drags and pans, in ms; 0 is off (#104). */
  pointerSmoothing: number;
}

const STORAGE_KEY = 'mtg-harmony_settings';

const defaults: AppSettings = {
  wakeLockEnabled: true,
  imagesEnabled: true,
  cardOutlineEnabled: true,
  pointerSmoothing: 0,
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

  function reset() {
    wakeLockEnabled.value = defaults.wakeLockEnabled;
    imagesEnabled.value = defaults.imagesEnabled;
    cardOutlineEnabled.value = defaults.cardOutlineEnabled;
    pointerSmoothing.value = defaults.pointerSmoothing;
  }

  function save() {
    const { save: persist } = useLocalStorage();
    persist(STORAGE_KEY, {
      wakeLockEnabled: wakeLockEnabled.value,
      imagesEnabled: imagesEnabled.value,
      cardOutlineEnabled: cardOutlineEnabled.value,
      pointerSmoothing: pointerSmoothing.value,
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

    return true;
  }

  load();

  watch(
    [wakeLockEnabled, imagesEnabled, cardOutlineEnabled, pointerSmoothing],
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
  };
});
