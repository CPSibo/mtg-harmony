export interface WidgetCommand {
  id: string;
  label: string;
  description?: string;
  icon: string;
  kbds?: string;
  execute: () => void;
}

export interface WidgetDefinition {
  id: string;
  label: string;
  icon: string;
  commands: WidgetCommand[];
}
