import { afterEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import FloatingBar from '~/features/palette/components/FloatingBar.vue';
import { mountInApp, unmountAll } from '../../fixtures/mount';

describe('FloatingBar', () => {
  afterEach(unmountAll);

  // #230: the search box kept focus while the palette animated out, so the
  // next "/" was typed into it instead of opening the palette again.
  it('lets go of focus as soon as it starts closing', async () => {
    const wrapper = mountInApp(FloatingBar, { props: { open: true } });
    const input = await vi.waitFor(() => {
      const el = document.querySelector<HTMLInputElement>(
        '[role=dialog] input',
      );
      if (!el) throw new Error('No search box yet');
      return el;
    });
    input.focus();
    expect(document.activeElement).toBe(input);

    await wrapper.setProps({ open: false });
    await nextTick();

    expect(document.activeElement).not.toBe(input);
  });
});
