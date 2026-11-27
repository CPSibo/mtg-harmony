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
import {
  normalizeBoardColors,
  type BoardColor,
} from '~/features/boardBackground/colors';
import {
  DEFAULT_EMBLEM_STYLE,
  isEmblemStyle,
  type EmblemStyle,
} from '~/features/boardBackground/emblems';
import { prefersReducedData } from '~/utils/saveData';
export interface AppSettings {
  /** Whether the Screen Wake Lock API is requested. */
  wakeLockEnabled: boolean;

  /** Whether to show card images. Starts off when the browser asks to save data (#242). */
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

  /** Whether attaching or putting under plays a small flourish (#124). */
  attachFlareEnabled: boolean;

  /** How many cards On-deck fetches at a time. */
  fetchCardCount: number;

  /** On-deck tops up in the background below this many queued cards. */
  minQueuedCardCount: number;

  /** Whether On-deck preloads the next queued card's image. Starts off like `imagesEnabled`. */
  preloadImagesEnabled: boolean;

  /** Whether new cards go in their row of the view (#223). */
  arrangeNewCards: boolean;

  /** Whether Space, Space runs Smart arrange, as `a-a` does (#235). */
  arrangeShortcutEnabled: boolean;

  /** Whether the board shows the themed background instead of the grid (#246). */
  boardBackgroundEnabled: boolean;

  /** The colours the board background shows, in WUBRGC order; none is a neutral board (#246). */
  boardColors: BoardColor[];

  /** Whether the background shows the colours of the cards on the board instead of `boardColors`. */
  boardColorsAuto: boolean;

  /** Whether the board background washes soft glows of its colours over the board. */
  boardSpotlightsEnabled: boolean;

  /** How the board background's emblems are drawn (#250). */
  boardEmblemStyle: EmblemStyle;
}

/** The most On-deck may fetch or keep queued, as the settings dialog allows. */
export const MAX_QUEUE_SIZE = 50;

const isQueueSize = (v: unknown): v is number =>
  Number.isInteger(v) && (v as number) >= 1 && (v as number) <= MAX_QUEUE_SIZE;

const STORAGE_KEY = 'mtg-harmony_settings';
/** Bump when the saved shape changes (#154). */
const SAVE_VERSION = 1;

const defaults: AppSettings = {
  wakeLockEnabled: true,
  imagesEnabled: true,
  cardOutlineEnabled: true,
  pointerSmoothing: 0,
  dragMenuDelay: DRAG_MENU_DELAY_MS,
  castFlight: CAST_FLIGHT_DEFAULT,
  castLanding: CAST_LANDING_DEFAULT,
  castDuration: CAST_DURATION_DEFAULT,
  attachFlareEnabled: true,
  fetchCardCount: 10,
  minQueuedCardCount: 3,
  preloadImagesEnabled: true,
  arrangeNewCards: false,
  arrangeShortcutEnabled: true,
  boardBackgroundEnabled: true,
  boardColors: [],
  boardColorsAuto: true,
  boardSpotlightsEnabled: false,
  boardEmblemStyle: DEFAULT_EMBLEM_STYLE,
};

/**
 * The defaults on this device: images and preloading start off when the browser
 * asks to save data (#242). They follow the browser until settings are first
 * saved (any change saves them all); from then on the saved values win.
 */
function deviceDefaults(): AppSettings {
  const saveData = prefersReducedData();
  return {
    ...defaults,
    imagesEnabled: defaults.imagesEnabled && !saveData,
    preloadImagesEnabled: defaults.preloadImagesEnabled && !saveData,
  };
}

export const useSettingsStore = defineStore('settings', () => {
  const start = deviceDefaults();
  const wakeLockEnabled = ref<boolean>(defaults.wakeLockEnabled);
  function setWakeLockEnabled(value: boolean) {
    wakeLockEnabled.value = value;
  }

  const imagesEnabled = ref<boolean>(start.imagesEnabled);
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
  const attachFlareEnabled = ref<boolean>(defaults.attachFlareEnabled);

  // On-deck's, here so Reset app restores them with the rest (#159).
  const fetchCardCount = ref<number>(defaults.fetchCardCount);
  const minQueuedCardCount = ref<number>(defaults.minQueuedCardCount);
  const preloadImagesEnabled = ref<boolean>(start.preloadImagesEnabled);
  const arrangeNewCards = ref<boolean>(defaults.arrangeNewCards);
  const arrangeShortcutEnabled = ref<boolean>(defaults.arrangeShortcutEnabled);

  const boardBackgroundEnabled = ref<boolean>(defaults.boardBackgroundEnabled);
  function setBoardBackgroundEnabled(value: boolean) {
    boardBackgroundEnabled.value = value;
  }

  const boardColors = ref<BoardColor[]>([...defaults.boardColors]);
  function setBoardColors(value: readonly BoardColor[]) {
    boardColors.value = normalizeBoardColors(value);
  }
  const boardColorsAuto = ref<boolean>(defaults.boardColorsAuto);
  function setBoardColorsAuto(value: boolean) {
    boardColorsAuto.value = value;
  }
  const boardSpotlightsEnabled = ref<boolean>(defaults.boardSpotlightsEnabled);
  function setBoardSpotlightsEnabled(value: boolean) {
    boardSpotlightsEnabled.value = value;
  }

  const boardEmblemStyle = ref<EmblemStyle>(defaults.boardEmblemStyle);
  function setBoardEmblemStyle(value: EmblemStyle) {
    boardEmblemStyle.value = value;
  }

  function toggleBoardColor(color: BoardColor) {
    setBoardColors(
      boardColors.value.includes(color)
        ? boardColors.value.filter((c) => c !== color)
        : [...boardColors.value, color],
    );
  }

  function reset() {
    // Ask again: the preference may have changed since the store started.
    const defaults = deviceDefaults();
    wakeLockEnabled.value = defaults.wakeLockEnabled;
    imagesEnabled.value = defaults.imagesEnabled;
    cardOutlineEnabled.value = defaults.cardOutlineEnabled;
    pointerSmoothing.value = defaults.pointerSmoothing;
    dragMenuDelay.value = defaults.dragMenuDelay;
    castFlight.value = defaults.castFlight;
    castLanding.value = defaults.castLanding;
    castDuration.value = defaults.castDuration;
    attachFlareEnabled.value = defaults.attachFlareEnabled;
    fetchCardCount.value = defaults.fetchCardCount;
    minQueuedCardCount.value = defaults.minQueuedCardCount;
    preloadImagesEnabled.value = defaults.preloadImagesEnabled;
    arrangeNewCards.value = defaults.arrangeNewCards;
    arrangeShortcutEnabled.value = defaults.arrangeShortcutEnabled;
    boardBackgroundEnabled.value = defaults.boardBackgroundEnabled;
    boardColors.value = [...defaults.boardColors];
    boardColorsAuto.value = defaults.boardColorsAuto;
    boardSpotlightsEnabled.value = defaults.boardSpotlightsEnabled;
    boardEmblemStyle.value = defaults.boardEmblemStyle;
  }

  function save() {
    const { save: persist } = useLocalStorage();
    persist(
      STORAGE_KEY,
      {
        wakeLockEnabled: wakeLockEnabled.value,
        imagesEnabled: imagesEnabled.value,
        cardOutlineEnabled: cardOutlineEnabled.value,
        pointerSmoothing: pointerSmoothing.value,
        dragMenuDelay: dragMenuDelay.value,
        castFlight: castFlight.value,
        castLanding: castLanding.value,
        castDuration: castDuration.value,
        attachFlareEnabled: attachFlareEnabled.value,
        fetchCardCount: fetchCardCount.value,
        minQueuedCardCount: minQueuedCardCount.value,
        preloadImagesEnabled: preloadImagesEnabled.value,
        arrangeNewCards: arrangeNewCards.value,
        arrangeShortcutEnabled: arrangeShortcutEnabled.value,
        boardBackgroundEnabled: boardBackgroundEnabled.value,
        boardColors: boardColors.value,
        boardColorsAuto: boardColorsAuto.value,
        boardSpotlightsEnabled: boardSpotlightsEnabled.value,
        boardEmblemStyle: boardEmblemStyle.value,
      },
      SAVE_VERSION,
    );
  }

  function load(): boolean {
    const { load: retrieve } = useLocalStorage();
    const data = retrieve<AppSettings>(STORAGE_KEY, SAVE_VERSION);

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

    if (typeof data.attachFlareEnabled === 'boolean')
      attachFlareEnabled.value = data.attachFlareEnabled;

    if (isQueueSize(data.fetchCardCount))
      fetchCardCount.value = data.fetchCardCount;

    if (isQueueSize(data.minQueuedCardCount))
      minQueuedCardCount.value = data.minQueuedCardCount;

    if (typeof data.preloadImagesEnabled === 'boolean')
      preloadImagesEnabled.value = data.preloadImagesEnabled;

    if (typeof data.arrangeNewCards === 'boolean')
      arrangeNewCards.value = data.arrangeNewCards;

    if (typeof data.arrangeShortcutEnabled === 'boolean')
      arrangeShortcutEnabled.value = data.arrangeShortcutEnabled;

    if (typeof data.boardBackgroundEnabled === 'boolean')
      boardBackgroundEnabled.value = data.boardBackgroundEnabled;

    if (Array.isArray(data.boardColors))
      boardColors.value = normalizeBoardColors(data.boardColors);

    if (typeof data.boardColorsAuto === 'boolean')
      boardColorsAuto.value = data.boardColorsAuto;

    if (typeof data.boardSpotlightsEnabled === 'boolean')
      boardSpotlightsEnabled.value = data.boardSpotlightsEnabled;

    if (isEmblemStyle(data.boardEmblemStyle))
      boardEmblemStyle.value = data.boardEmblemStyle;

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
      attachFlareEnabled,
      fetchCardCount,
      minQueuedCardCount,
      preloadImagesEnabled,
      arrangeNewCards,
      arrangeShortcutEnabled,
      boardBackgroundEnabled,
      boardColors,
      boardColorsAuto,
      boardSpotlightsEnabled,
      boardEmblemStyle,
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
    attachFlareEnabled,

    fetchCardCount,
    minQueuedCardCount,
    preloadImagesEnabled,
    arrangeNewCards,
    arrangeShortcutEnabled,

    boardBackgroundEnabled,
    setBoardBackgroundEnabled,

    boardColors,
    setBoardColors,
    toggleBoardColor,

    boardColorsAuto,
    setBoardColorsAuto,

    boardSpotlightsEnabled,
    setBoardSpotlightsEnabled,

    boardEmblemStyle,
    setBoardEmblemStyle,
  };
});
