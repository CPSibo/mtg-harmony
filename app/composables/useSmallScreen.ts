import { useMediaQuery } from '@vueuse/core';
import type { Ref } from 'vue';

/** True below Tailwind's `md` breakpoint (768px), where windows go full screen. */
export function useSmallScreen(): Ref<boolean> {
  return useMediaQuery('(max-width: 767.98px)');
}
