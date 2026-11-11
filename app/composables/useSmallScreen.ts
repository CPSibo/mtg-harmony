import { useMediaQuery } from '@vueuse/core';
import type { Ref } from 'vue';

/** True below Tailwind's `sm` breakpoint (640px), where windows go full screen. */
export function useSmallScreen(): Ref<boolean> {
  return useMediaQuery('(max-width: 639.98px)');
}
