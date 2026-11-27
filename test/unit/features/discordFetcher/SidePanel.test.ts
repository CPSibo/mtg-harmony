import { flushPromises } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import type { ScryfallCardResponse } from '~/composables/useScryfall';
import { useBattlefieldStore } from '~/features/battlefield';
import { useDiscordFetcherStore } from '~/features/discordFetcher';
import { useWidgetRegistry } from '~/features/widgets';
import SidePanel from '~/features/discordFetcher/components/SidePanel.vue';
import { makeScryfallCard } from '../../fixtures/cards';
import { buttonNamed, mountInApp, unmountAll } from '../../fixtures/mount';

let produce: (n: number) => (ScryfallCardResponse | string)[];

vi.mock('~/composables/useScryfall', async (importOriginal) => ({
  ...(await importOriginal<typeof import('~/composables/useScryfall')>()),
  useScryfall: () => ({
    fetch: vi.fn(),
    fetchMany: async function* (n: number) {
      for (const result of produce(n)) yield result;
    },
  }),
}));

const toasts: { title?: string; description?: string }[] = [];
vi.mock('@nuxt/ui/composables', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@nuxt/ui/composables')>()),
  useToast: () => ({
    add: (toast: (typeof toasts)[number]) => toasts.push(toast),
  }),
}));

let fetched = 0;
const bears = (n: number) =>
  Array.from({ length: n }, () => ({
    data: makeScryfallCard({ name: `Bear ${++fetched}` }),
    date: new Date(),
  }));

/** Mounts the panel and opens its drawer. */
async function openPanel() {
  mountInApp(SidePanel);
  buttonNamed('On-deck').click();
  await flushPromises();
}

describe('SidePanel (#171)', () => {
  beforeEach(() => {
    fetched = 0;
    toasts.length = 0;
    produce = bears;
    // Stop the image preloader from touching the network.
    vi.stubGlobal(
      'Image',
      class {
        src = '';
      },
    );
  });
  afterEach(unmountAll);

  it('opens with nothing to cast', async () => {
    await openPanel();

    expect(document.body.textContent).toContain('Tap to fetch next card');
    expect(buttonNamed('Cast to board').disabled).toBe(true);
    expect(buttonNamed('Prev card').disabled).toBe(true);
  });

  it('fetches the next card', async () => {
    await openPanel();

    buttonNamed('Next card').click();
    await flushPromises();

    expect(useDiscordFetcherStore().card?.scryfallInfo.name).toBe('Bear 1');
    expect(buttonNamed('Cast to board').disabled).toBe(false);
  });

  it('fetches from the placeholder too', async () => {
    await openPanel();

    document
      .querySelector<HTMLElement>('.on-deck-display > .cursor-pointer')!
      .click();
    await flushPromises();

    expect(useDiscordFetcherStore().card?.scryfallInfo.name).toBe('Bear 1');
  });

  it('shows a toast when the fetch fails', async () => {
    produce = () => ['Scryfall is down'];
    await openPanel();

    buttonNamed('Next card').click();
    await flushPromises();

    expect(toasts).toEqual([expect.objectContaining({ title: 'Fetch Error' })]);
    expect(useDiscordFetcherStore().card).toBeNull();
  });

  it('casts the card to the board, clears it and closes', async () => {
    await openPanel();
    buttonNamed('Next card').click();
    await flushPromises();

    buttonNamed('Cast to board').click();
    await flushPromises();

    expect(
      useBattlefieldStore().stacks.map((s) => s.primary.scryfallInfo.name),
    ).toEqual(['Bear 1']);
    expect(useDiscordFetcherStore().card).toBeNull();
    expect(document.body.textContent).not.toContain('Cast to board');
  });

  it('steps back to the previous card', async () => {
    await openPanel();
    buttonNamed('Next card').click();
    await flushPromises();
    buttonNamed('Next card').click();
    await flushPromises();

    buttonNamed('Prev card').click();
    await flushPromises();

    expect(useDiscordFetcherStore().card?.scryfallInfo.name).toBe('Bear 1');
  });

  it('opens itself for Next card from the palette (#237)', async () => {
    mountInApp(SidePanel);
    await flushPromises();
    expect(document.body.textContent).not.toContain('Cast to board');

    useWidgetRegistry()
      .allCommands.find((c) => c.id === 'onDeck.next')!
      .execute();
    await flushPromises();

    expect(useDiscordFetcherStore().card?.scryfallInfo.name).toBe('Bear 1');
    expect(buttonNamed('Cast to board').disabled).toBe(false);
  });

  describe('hides while a card is dragged out of it (#256)', () => {
    const pointer = { pointerId: 1, isPrimary: true, button: 0, buttons: 1 };
    const isOpen = () => document.body.textContent!.includes('Cast to board');

    /** Opens the panel with a card, as a pane `width` px wide. */
    async function openWithCard(width: number) {
      await openPanel();
      buttonNamed('Next card').click();
      await flushPromises();
      const panel = document.querySelector<HTMLElement>('[role="dialog"]')!;
      vi.spyOn(panel, 'getBoundingClientRect').mockReturnValue(
        new DOMRect(0, 0, width, window.innerHeight),
      );
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    }

    /** Presses the card and drags it to `x`, in screen px. */
    async function dragTo(x: number) {
      const card = document.querySelector<HTMLElement>(
        '[title="Drag onto the board to cast"], [title^="Tap to enlarge"]',
      )!;
      card.dispatchEvent(
        new PointerEvent('pointerdown', {
          ...pointer,
          clientX: 10,
          clientY: 10,
        }),
      );
      await moveTo(x);
    }

    async function moveTo(x: number) {
      window.dispatchEvent(
        new PointerEvent('pointermove', {
          ...pointer,
          clientX: x,
          clientY: 10,
        }),
      );
      await nextTick();
    }

    async function wait(ms: number) {
      vi.advanceTimersByTime(ms);
      await nextTick();
    }

    afterEach(() => vi.useRealTimers());

    it('after 800 ms outside the pane', async () => {
      await openWithCard(300);

      await dragTo(500);
      await wait(799);
      expect(isOpen()).toBe(true);

      await wait(1);
      await vi.runAllTimersAsync();
      expect(isOpen()).toBe(false);
    });

    it('not when the card comes back over the pane in time', async () => {
      await openWithCard(300);

      await dragTo(500);
      await wait(700);
      await moveTo(100);
      await wait(700);
      await vi.runAllTimersAsync();

      expect(isOpen()).toBe(true);
    });

    it('starting over each time the card leaves', async () => {
      await openWithCard(300);

      await dragTo(500);
      await wait(700);
      await moveTo(100);
      await moveTo(500);
      await wait(700);
      expect(isOpen()).toBe(true);

      await wait(100);
      await vi.runAllTimersAsync();
      expect(isOpen()).toBe(false);
    });

    it('not when the panel fills the screen', async () => {
      await openWithCard(window.innerWidth);

      await dragTo(window.innerWidth + 50);
      await wait(2000);
      await vi.runAllTimersAsync();

      expect(isOpen()).toBe(true);
    });
  });
});
