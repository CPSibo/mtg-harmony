import { useMediaQuery } from '@vueuse/core';
import type { Ref } from 'vue';

/** True below Tailwind's `lg` breakpoint (1024px), i.e. `md` and smaller, where windows go full screen. */
export function useSmallScreen(): Ref<boolean> {
  return useMediaQuery('(max-width: 1023.98px)');
}
