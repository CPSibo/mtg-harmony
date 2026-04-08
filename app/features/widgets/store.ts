import type { WidgetDefinition } from '~/types/Widgets'

export const useWidgetRegistry = defineStore('widgetRegistry', () => {
  const widgets = ref<Map<string, WidgetDefinition>>(new Map())

  function register(widget: WidgetDefinition) {
    widgets.value.set(widget.id, widget)
  }

  function unregister(id: string) {
    widgets.value.delete(id)
  }

  const widgetObjects = computed(() => {
    return widgets.value.values()
  })

  const allCommands = computed(() =>
    widgetObjects.value.flatMap(w => w.commands)
  )

  const paletteGroups = computed(() =>
    widgetObjects.value.map(w => ({
      id: w.id,
      label: w.label,
      items: w.commands.map(cmd => ({
        label: cmd.label,
        icon: cmd.icon,
        kbds: cmd.kbds,
        onSelect: cmd.execute,
      })),
    }))
  )

  const allSettings = computed(() =>
    widgetObjects.value
      .filter(w => w.settings?.length)
      .map(w => ({ widget: w, settings: w.settings! }))
  )

  return { register, unregister, allCommands, paletteGroups, allSettings }
})