export type InputMode = 'touch' | 'cursor';

export interface InputModeState {
  inputMode: InputMode;
}

const STORAGE_KEY = 'mtg-harmony_inputMode';

const defaults: InputModeState = {
  inputMode: 'cursor',
};

export const useInputModeStore = defineStore('inputMode', () => {
  const inputMode = ref<InputMode>(defaults.inputMode);

  const isTouch = computed(() => inputMode.value === 'touch');
  const isCursor = computed(() => inputMode.value === 'cursor');

  function setInputMode(mode: InputMode) {
    if (inputMode.value === mode) return;
    inputMode.value = mode;
  }

  // Pointer Events report an accurate pointerType for both clicks/taps
  // (pointerdown) and drags (pointermove), so a single handler on both
  // covers switching back and forth on hybrid touch/mouse devices.
  function handlePointerEvent(event: PointerEvent) {
    setInputMode(event.pointerType === 'touch' ? 'touch' : 'cursor');
  }

  function reset() {
    inputMode.value = defaults.inputMode;
  }

  function save() {
    const { save: persist } = useLocalStorage();
    persist(STORAGE_KEY, {
      inputMode: inputMode.value,
    });
  }

  function load(): boolean {
    const { load: retrieve } = useLocalStorage();
    const data = retrieve<InputModeState>(STORAGE_KEY);

    if (!data) return false;

    if (data.inputMode === 'touch' || data.inputMode === 'cursor')
      inputMode.value = data.inputMode;

    return true;
  }

  if (import.meta.client) {
    const loaded = load();

    // No prior session to go on - guess from the device's primary pointer
    // so touch-first devices don't render a cursor-styled UI until the
    // user's first tap.
    if (!loaded && window.matchMedia?.('(pointer: coarse)').matches) {
      inputMode.value = 'touch';
    }

    window.addEventListener('pointerdown', handlePointerEvent, {
      passive: true,
    });
    window.addEventListener('pointermove', handlePointerEvent, {
      passive: true,
    });
  }

  watch(inputMode, () => {
    save();
  });

  return {
    save,
    load,
    reset,

    inputMode,
    isTouch,
    isCursor,
  };
});
