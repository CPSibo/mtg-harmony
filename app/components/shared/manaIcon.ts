import { h, markRaw, type FunctionalComponent } from 'vue';

/**
 * A mana-font symbol (`ms-tap`, `ms-ability-first-strike`…) as an icon
 * component, for anywhere Nuxt UI takes an `icon` (#237): it renders a
 * component given instead of an Iconify name. `symbol` may be a getter, for
 * an icon that follows the state, like Tap and Untap; it's read as the icon
 * renders, so it updates with what it reads. Name a new `ms-*` class and run
 * `npm run fonts:mana`.
 */
export function manaIcon(symbol: string | (() => string)): FunctionalComponent {
  const icon: FunctionalComponent = () =>
    h('span', {
      class: ['ms mana-icon', typeof symbol === 'function' ? symbol() : symbol],
      'aria-hidden': 'true',
    });
  return markRaw(icon);
}
