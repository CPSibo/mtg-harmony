export interface WidgetCommand {
  id: string;
  label: string;
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
  commands: WidgetCommand[];
}
