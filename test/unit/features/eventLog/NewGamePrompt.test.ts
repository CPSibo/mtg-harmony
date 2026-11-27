import { flushPromises } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useBattlefieldStore } from '~/features/battlefield';
import { useEventLogStore } from '~/features/eventLog';
import NewGamePrompt from '~/features/eventLog/components/NewGamePrompt.vue';
import { makeScryfallCard } from '../../fixtures/cards';
import { buttonNamed, mountInApp, unmountAll } from '../../fixtures/mount';

const HOUR = 60 * 60 * 1000;
const TITLE = 'Start a new game?';

/** A card cast `hoursAgo` hours ago, and nothing since. */
function castHoursAgo(hoursAgo: number) {
  const now = Date.now();
  vi.setSystemTime(now - hoursAgo * HOUR);
  useBattlefieldStore().castCard(makeScryfallCard({ name: 'Bear' }));
  vi.setSystemTime(now);
}

async function mountPrompt() {
  mountInApp(NewGamePrompt);
  await flushPromises();
}

const promptShown = () => document.body.textContent?.includes(TITLE) ?? false;

let visibility: DocumentVisibilityState = 'visible';

describe('NewGamePrompt (#171)', () => {
  beforeEach(() => {
    // Only the clock: Vue and Nuxt UI keep their real timers.
    vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 10, 7, 20, 0) });
    visibility = 'visible';
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(
      () => visibility,
    );
  });
  afterEach(unmountAll);

  it('offers a new game after 2 hours without events', async () => {
    castHoursAgo(3);

    await mountPrompt();

    expect(promptShown()).toBe(true);
  });

  it('stays quiet when something happened recently', async () => {
    castHoursAgo(1);

    await mountPrompt();

    expect(promptShown()).toBe(false);
  });

  it('stays quiet with nothing on the board', async () => {
    castHoursAgo(3);
    useBattlefieldStore().reset();

    await mountPrompt();

    expect(promptShown()).toBe(false);
  });

  it('checks again when the tab comes back into view', async () => {
    castHoursAgo(1);
    await mountPrompt();

    visibility = 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));
    await flushPromises();
    vi.setSystemTime(Date.now() + 2 * HOUR);
    visibility = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
    await flushPromises();

    expect(promptShown()).toBe(true);
  });

  it('remembers "Keep playing" until the next event', async () => {
    castHoursAgo(3);
    await mountPrompt();

    buttonNamed('Keep playing').click();
    await flushPromises();

    expect(promptShown()).toBe(false);
    expect(useEventLogStore().newGameOfferDismissedAt).toBe(Date.now());
    expect(useBattlefieldStore().stacks).toHaveLength(1);
  });

  it('starts a new game from the prompt', async () => {
    castHoursAgo(3);
    await mountPrompt();

    buttonNamed('New game').click();
    await flushPromises();

    const log = useEventLogStore();
    expect(promptShown()).toBe(false);
    expect(useBattlefieldStore().stacks).toEqual([]);
    expect(log.entries.at(-1)).toMatchObject({
      type: 'gameMarker',
      reason: 'idlePrompt',
    });
  });
});
