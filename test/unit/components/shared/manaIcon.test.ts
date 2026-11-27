import { afterEach, describe, expect, it } from 'vitest';
import { defineComponent, h, nextTick, ref } from 'vue';
import { manaIcon } from '~/components/shared/manaIcon';
import { mountInApp, unmountAll } from '../../fixtures/mount';

describe('manaIcon (#237)', () => {
  afterEach(unmountAll);

  it('renders the symbol, and follows a getter', async () => {
    const tapped = ref(false);
    const Icon = manaIcon(() => (tapped.value ? 'ms-untap' : 'ms-tap'));
    const wrapper = mountInApp(defineComponent({ render: () => h(Icon) }));
    expect(wrapper.find('span').classes()).toEqual(
      expect.arrayContaining(['ms', 'mana-icon', 'ms-tap']),
    );

    tapped.value = true;
    await nextTick();
    expect(wrapper.find('span').classes()).toContain('ms-untap');
  });
});
