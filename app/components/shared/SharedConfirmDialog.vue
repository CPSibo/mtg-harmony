<script setup lang="ts">
const props = defineProps<{
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
}>()

const emit = defineEmits<{
  (e: 'confirm'): void
  (e: 'cancel'): void
  (e: 'update:open', value: boolean): void
}>()

function onCancel() {
  emit('cancel')
  emit('update:open', false)
}

useEventListener(document, 'keydown', (e: KeyboardEvent) => {
  if (props.open && e.key === 'Escape') onCancel()
})
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-150"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-100"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/50" @click="onCancel" />

        <!-- Panel -->
        <Transition
          enter-active-class="transition duration-150"
          enter-from-class="opacity-0 scale-95"
          enter-to-class="opacity-100 scale-100"
          leave-active-class="transition duration-100"
          leave-from-class="opacity-100 scale-100"
          leave-to-class="opacity-0 scale-95"
          appear
        >
          <div
            v-if="open"
            class="relative w-full max-w-sm rounded-lg bg-white p-6 shadow-xl dark:bg-slate-800"
          >
            <h2 class="mb-2 text-base font-semibold text-slate-900 dark:text-slate-100">
              {{ title }}
            </h2>
            <p class="mb-6 text-sm text-slate-600 dark:text-slate-400">
              {{ message }}
            </p>
            <div class="flex justify-end gap-2">
              <UButton variant="ghost" @click="onCancel">
                {{ cancelLabel ?? 'Cancel' }}
              </UButton>
              <UButton color="primary" @click="emit('confirm')">
                {{ confirmLabel ?? 'Confirm' }}
              </UButton>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
