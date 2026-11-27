import { afterEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import EmblemStylePicker from '~/components/settings/EmblemStylePicker.vue';
import { useSettingsStore } from '~/stores/settings';
import { mountInApp, unmountAll } from '../../fixtures/mount';

const button = () =>
  document.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]')!;
const radios = () => [
  ...document.querySelectorAll<HTMLButtonElement>('[role="radio"]'),
];

/** Waits for the list to open or close; the modal animates. */
async function settle() {
  for (let i = 0; i < 5; i++) await nextTick();
  await new Promise((done) => setTimeout(done, 0));
}

describe('EmblemStylePicker', () => {
  afterEach(unmountAll);

  it('names the style set, art deco to start', () => {
    mountInApp(EmblemStylePicker);
    expect(button().textContent).toContain('Art deco');
  });

  it('lists every style with a preview of its six emblems', async () => {
    mountInApp(EmblemStylePicker);
    button().click();
    await settle();
    expect(radios().map((r) => r.textContent!.trim())).toEqual([
      'Art deco',
      'Constellations',
      'Knotwork',
      'Carved stone',
      'Brushed line art',
      'Mana symbols, outlined',
      'Mana symbols, coloured outline',
      'Mana symbols, solid',
      'Mana symbols, coin',
    ]);
    expect(radios()[0]!.getAttribute('aria-checked')).toBe('true');
    expect(radios()[1]!.getAttribute('aria-checked')).toBe('false');
    for (const radio of radios()) {
      const previews = radio.querySelectorAll('img');
      expect(previews).toHaveLength(6);
      expect(previews[0]!.getAttribute('src')).toMatch(
        /^data:image\/svg\+xml,/,
      );
    }
  });

  it('picks a style and closes the list', async () => {
    const settings = useSettingsStore();
    mountInApp(EmblemStylePicker);
    button().click();
    await settle();
    radios()
      .find((r) => r.textContent!.includes('Knotwork'))!
      .click();
    await settle();
    expect(settings.boardEmblemStyle).toBe('knot');
    await vi.waitFor(() => expect(radios()).toHaveLength(0));
    expect(button().textContent).toContain('Knotwork');
  });

  it('is disabled while the background is off', async () => {
    const settings = useSettingsStore();
    settings.setBoardBackgroundEnabled(false);
    mountInApp(EmblemStylePicker);
    await nextTick();
    expect(button().disabled).toBe(true);
  });
});
