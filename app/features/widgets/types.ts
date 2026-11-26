export interface WidgetCommand {
  id: string;
  /** A function for a label that follows the state, like Tap or Untap (#235). */
  label: string | (() => string);
  description?: string;
  icon: string;
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
  execute: () => void;
}

export interface WidgetCommandChoice {
  label: string;
  icon: string;
  execute: () => void;
}

export interface WidgetDefinition {
  id: string;
  label: string;
  icon: string;
  /** Where its group goes in the palette, lowest first; missing goes last. */
  order?: number;
  /**
   * Hidden from the palette while something is selected (#235), as it isn't
   * about the selection. Its shortcuts still work.
   */
  hideWithSelection?: boolean;
  commands: WidgetCommand[];
}
