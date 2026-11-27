import { addCollection } from '@iconify/vue';
import ui from '@nuxt/ui/vue-plugin';
import { mount, type ComponentMountingOptions } from '@vue/test-utils';
import { getActivePinia } from 'pinia';
import type { Component } from 'vue';
import lucide from '~/assets/icons/lucide.json';

// The app's bundled icons, as main.ts adds them, so none is fetched.
addCollection(lucide);

/**
 * Mounts a component as the app does: with the test's Pinia (from setup.ts)
 * and Nuxt UI, attached to the document so teleported overlays (modals,
 * slideovers) can be found with `document.body`. Unmount it at the end with
 * `wrapper.unmount()`; `mounted` tracks every wrapper for `unmountAll`.
 */
export function mountInApp<C extends Component>(
  component: C,
  options: ComponentMountingOptions<C> = {},
) {
  const wrapper = mount(component, {
    attachTo: document.body,
    ...options,
    global: {
      ...options.global,
      plugins: [getActivePinia()!, ui, ...(options.global?.plugins ?? [])],
    },
  } as ComponentMountingOptions<C>);
  mounted.push(wrapper);
  return wrapper;
}

const mounted: { unmount(): void }[] = [];

/** Unmounts everything `mountInApp` mounted, and empties the document. */
export function unmountAll() {
  for (const wrapper of mounted.splice(0)) wrapper.unmount();
  document.body.innerHTML = '';
}

/** The button in the document whose text is `name`. */
export function buttonNamed(name: string) {
  const button = [...document.querySelectorAll('button')].find(
    (b) => b.textContent?.trim() === name,
  );
  if (!button) throw new Error(`No button named "${name}"`);
  return button;
}
