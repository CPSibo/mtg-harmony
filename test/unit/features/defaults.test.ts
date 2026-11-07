import { createPinia, setActivePinia } from 'pinia';
import { describe, expect, it } from 'vitest';
import { useBattlefieldStore } from '~/features/battlefield';
import { useDiscordFetcherStore } from '~/features/discordFetcher';
import { makeCard } from '../fixtures/cards';

// #27: stores used to wrap their module-level defaults in refs, so changes
// leaked into every later store instance.
describe('store defaults are not shared between instances', () => {
  it('battlefield', () => {
    const first = useBattlefieldStore();
    first.addStackByCard(makeCard());
    first.bringToFront(first.stacks[0]!);
    first.center.x = 500;

    localStorage.clear();
    setActivePinia(createPinia());
    const second = useBattlefieldStore();

    expect(second.stacks).toEqual([]);
    expect(second.orderedStacks).toEqual([]);
    expect(second.center).toEqual({ x: 0, y: 0 });
  });

  it('discord fetcher', () => {
    const first = useDiscordFetcherStore();
    first.cards.push(makeCard());

    localStorage.clear();
    setActivePinia(createPinia());
    const second = useDiscordFetcherStore();

    expect(second.cards).toEqual([]);
  });
});
