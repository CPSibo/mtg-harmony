import type { KbdProps } from '@nuxt/ui';

export interface WidgetCommand {
  id: string;
  label: string;
  description?: string;
  icon: string;
  kbds?: (string | undefined)[] | KbdProps[] | undefined;
  execute: () => void;
}

export interface WidgetSetting<T> {
  id: string;
  label: string;
  description?: string;
  type: 'boolean' | 'select' | 'number';
  options?: { label: string; value: T }[];
  value: () => T;
  set: (v: T) => void;
}

export interface WidgetDefinition {
  id: string;
  label: string;
  icon: string;
  commands: WidgetCommand[];
  settings?: WidgetSetting[];
}
