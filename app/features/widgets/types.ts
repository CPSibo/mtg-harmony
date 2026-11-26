import type { Component } from 'vue';
import type { Position } from '@vueuse/core';

/**
 * An Iconify name (`i-lucide-…`), or a component, such as a mana symbol from
 * `manaIcon` (#237). Nuxt UI renders either.
 */
export type WidgetIcon = string | Component;

export interface WidgetCommand {
  id: string;
  /** A function for a label that follows the state, like Tap or Untap (#235). */
  label: string | (() => string);
  description?: string;
  icon: WidgetIcon;
  kbds?: string;
  /**
   * Whether the command applies right now (#216). The palette hides it and
   * its shortcut does nothing while this is false. Read reactively, so it
   * should read reactive state. Missing means always.
   */
  enabled?: () => boolean;
  /**
   * `selection` commands act on the selected stacks. The palette lists them
   * together in a Selection group, whichever widget they come from.
   */
  scope?: 'selection';
  /**
   * Where the selection bar shows a selection command: as a `button`, or in
   * its "More…" `menu`. Missing means the palette only.
   */
  bar?: 'button' | 'menu';
  /**
   * Ways to run the command, such as Copy's three modes (#221). The palette
   * lists them under the command, and the bar opens them as a menu. With
   * choices, `execute` isn't used.
   */
  choices?: WidgetCommandChoice[];
  /**
   * Running a command leaves selection mode unless it's about the selection
   * (#235): a `selection` command, or one marked here, such as Select all.
   */
  keepsSelectionMode?: boolean;
  /**
   * Checked before the shortcut runs, but not for the palette: for keys
   * that mean something else where focus is, like Space on a button.
   */
  shortcutGuard?: () => boolean;
  /**
   * An info toast saying what the command did (#237), read just before it
   * runs, so it can count or name what it acts on. Commands that ask for
   * more (Add card, Find) or open something (On-deck, the event log) have
   * none: what opens says enough.
   */
  toast?: () => string;
  /**
   * A structural board change undo can take back (#215): its toast gets an
   * Undo button.
   */
  undoable?: boolean;
  execute: () => void;
  /**
   * Runs the command at a board point instead, from the board menu (#244),
   * such as casting where it opened. Missing means `execute`.
   */
  executeAt?: (at: Position) => void;
}

export interface WidgetCommandChoice {
  label: string;
  icon: WidgetIcon;
  /** As the command's `toast`, for this choice. */
  toast?: () => string;
  execute: () => void;
}

export interface WidgetDefinition {
  id: string;
  label: string;
  icon: WidgetIcon;
  /** Where its group goes in the palette, lowest first; missing goes last. */
  order?: number;
  /**
   * Hidden from the palette while something is selected (#235), as it isn't
   * about the selection. Its shortcuts still work.
   */
  hideWithSelection?: boolean;
  commands: WidgetCommand[];
}
