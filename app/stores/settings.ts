export interface AppSettings {
  /** Whether the On-Deck slot is expanded. */
  onDeckExpanded: boolean;

  /** Whether the Screen Wake Lock API is requested. */
  wakeLockEnabled: boolean;

  /** Whether to show card images. */
  imagesEnabled: boolean;
}

const STORAGE_KEY = 'mtg-harmony_settings';

const defaults: AppSettings = {
  onDeckExpanded: true,
  wakeLockEnabled: true,
  imagesEnabled: true,
};

export const useSettingsStore = defineStore('settings', () => {
  const onDeckExpanded = ref<boolean>(defaults.onDeckExpanded);
  function toggleOnDeckExpanded() {
    onDeckExpanded.value = !onDeckExpanded.value;
  }

  const wakeLockEnabled = ref<boolean>(defaults.wakeLockEnabled);
  function setWakeLockEnabled(value: boolean) {
    wakeLockEnabled.value = value;
  }

  const imagesEnabled = ref<boolean>(defaults.imagesEnabled);
  function setImagesEnabled(value: boolean) {
    imagesEnabled.value = value;
  }

  function reset() {
    onDeckExpanded.value = defaults.onDeckExpanded;
    wakeLockEnabled.value = defaults.wakeLockEnabled;
    imagesEnabled.value = defaults.imagesEnabled;
  }

  function save() {
    const { save: persist } = useLocalStorage();
    persist(STORAGE_KEY, {
      onDeckExpanded: onDeckExpanded.value,
      wakeLockEnabled: wakeLockEnabled.value,
      imagesEnabled: imagesEnabled.value,
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

    if (typeof data.wakeLockEnabled === 'boolean')
      wakeLockEnabled.value = data.wakeLockEnabled;

    if (typeof data.imagesEnabled === 'boolean')
      imagesEnabled.value = data.imagesEnabled;

    return true;
  }

  if (import.meta.client) load();

  watch([onDeckExpanded, wakeLockEnabled], () => {
    save();
  });

  return {
    save,
    load,
    reset,

    onDeckExpanded,
    toggleOnDeckExpanded,

    wakeLockEnabled,
    setWakeLockEnabled,

    imagesEnabled,
    setImagesEnabled,
  };
});
