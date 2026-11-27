import { flushPromises } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import SettingsModal from '~/components/settings/SettingsModal.vue';
import { mountInApp, unmountAll } from '../../fixtures/mount';

const smallScreen = ref(false);
vi.mock('~/composables/useSmallScreen', () => ({
  useSmallScreen: () => smallScreen,
}));

const headings = (selector: string) =>
  [...document.querySelectorAll(selector)].map((h) => h.textContent?.trim());

async function open() {
  mountInApp(SettingsModal, { props: { open: true } });
  await flushPromises();
}

describe('SettingsModal', () => {
  afterEach(() => {
    unmountAll();
    smallScreen.value = false;
  });

  it('has a Style tab, with the board and animation settings in sections', async () => {
    await open();
    expect(headings('[role="tab"]')).toEqual([
      'General',
      'On-deck',
      'Field',
      'Style',
    ]);

    const style = [...document.querySelectorAll('[role="tab"]')].at(-1)!;
    style.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await flushPromises();

    expect(
      headings('[role="tabpanel"][data-state="active"] section > h3'),
    ).toEqual(['Board', 'Animation']);
    const text = document.querySelector(
      '[role="tabpanel"][data-state="active"]',
    )!.textContent;
    for (const label of [
      'Board background',
      'Match the board',
      'Card outline',
      'Cast flight',
    ])
      expect(text).toContain(label);
  });

  it('on a small screen, shows every tab in one page, sections a level below', async () => {
    smallScreen.value = true;
    await open();

    expect(document.querySelector('[role="tab"]')).toBeNull();
    expect(headings('h3')).toEqual(['General', 'On-deck', 'Field', 'Style']);
    expect(headings('h4')).toEqual(['Board', 'Animation']);
  });
});
