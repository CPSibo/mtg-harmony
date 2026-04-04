export interface AppSettings {
  /** Whether the On-Deck slot is expanded. */
  onDeckExpanded: boolean;

  /** Whether the background prefetch queue is active. */
  prefetchEnabled: boolean;

  /** Whether the Screen Wake Lock API is requested. */
  wakeLockEnabled: boolean;

  /** Whether to show card images. */
  imagesEnabled: boolean;

  /** Pixel grid size for snapping board cards.
   *  Falsey to disable snapping. */
  snapScale: number;
}

const STORAGE_KEY = 'mtg-harmony_settings';

const defaults: AppSettings = {
  onDeckExpanded: true,
  prefetchEnabled: true,
  wakeLockEnabled: true,
  imagesEnabled: true,
  snapScale: 20,
};

export const useSettingsStore = defineStore('settings', () => {
  const onDeckExpanded = ref<boolean>(defaults.onDeckExpanded);
  function toggleOnDeckExpanded() {
    onDeckExpanded.value = !onDeckExpanded.value;
  }

  const prefetchEnabled = ref<boolean>(defaults.prefetchEnabled);
  function setPrefetchEnabled(value: boolean) {
    prefetchEnabled.value = value;
  }

  const wakeLockEnabled = ref<boolean>(defaults.wakeLockEnabled);
  function setWakeLockEnabled(value: boolean) {
    wakeLockEnabled.value = value;
  }

  const imagesEnabled = ref<boolean>(defaults.imagesEnabled);
  function setImagesEnabled(value: boolean) {
    imagesEnabled.value = value;
  }

  const snapScale = ref<number>(defaults.snapScale);
  function setsnapScale(value: number) {
    snapScale.value = value;
  }

  function clear() {
    const { save: persist } = useLocalStorage();
    persist(STORAGE_KEY, defaults);
    load();
  }

  function save() {
    const { save: persist } = useLocalStorage();
    persist(STORAGE_KEY, {
      onDeckExpanded: onDeckExpanded.value,
      prefetchEnabled: prefetchEnabled.value,
      wakeLockEnabled: wakeLockEnabled.value,
      imagesEnabled: imagesEnabled.value,
      snapScale: snapScale.value,
    });
  }

  function load(): boolean {
    const { load: retrieve } = useLocalStorage();
    const data = retrieve<AppSettings>(STORAGE_KEY);

    if (!data) {
      return false;
    }

    if (typeof data.onDeckExpanded === 'boolean')
      onDeckExpanded.value = data.onDeckExpanded;

    if (typeof data.prefetchEnabled === 'boolean')
      prefetchEnabled.value = data.prefetchEnabled;

    if (typeof data.wakeLockEnabled === 'boolean')
      wakeLockEnabled.value = data.wakeLockEnabled;

    if (typeof data.imagesEnabled === 'boolean')
      imagesEnabled.value = data.imagesEnabled;

    if (typeof data.snapScale === 'number') snapScale.value = data.snapScale;

    return true;
  }

  watch([onDeckExpanded, prefetchEnabled, wakeLockEnabled, snapScale], () => {
    save();
  });

  return {
    save,
    load,
    clear,

    onDeckExpanded,
    toggleOnDeckExpanded,

    prefetchEnabled,
    setPrefetchEnabled,

    wakeLockEnabled,
    setWakeLockEnabled,

    imagesEnabled,
    setImagesEnabled,

    snapScale,
    setsnapScale,
  };
});
