import { describe, expect, it, vi } from 'vitest';
import { computed, isProxy, nextTick } from 'vue';
import { flushSaves } from '~/composables/useLocalStorage';
import {
  MAX_ENTRIES,
  NEARLY_FULL_ENTRIES,
  snapshotCard,
  useEventLogStore,
  type EventEntry,
} from '~/features/eventLog';
import { setActivePinia, createPinia } from 'pinia';
import { makeCard, makeScryfallCard } from '../../fixtures/cards';

/** The logged card's name, for entries that have one. */
function cardName(entry: EventEntry | undefined) {
  return entry && 'card' in entry ? entry.card.name : undefined;
}

describe('event log store', () => {
  it('records an entry with a timestamp, the game and a card snapshot', () => {
    vi.useFakeTimers({ now: new Date('2026-11-07T12:00:00Z') });
    const log = useEventLogStore();
    const card = makeCard({ name: 'Ooze' });

    const entry = log.record('cast', { card });

    expect(log.entries).toEqual([entry]);
    expect(entry).toMatchObject({
      type: 'cast',
      at: Date.parse('2026-11-07T12:00:00Z'),
      gameId: log.gameId,
      card: {
        instanceId: card.id,
        scryfallId: card.scryfallInfo.id,
        name: 'Ooze',
        imageUri: card.image_uri,
        scryfallUri: card.scryfall_uri,
      },
    });
    expect(entry.id).toBeTruthy();
  });

  it('snapshots a Scryfall card without an instance ID', () => {
    const scryfall = makeScryfallCard({ name: 'Fetched' });

    expect(snapshotCard(scryfall)).toEqual({
      scryfallId: scryfall.id,
      name: 'Fetched',
      imageUri: scryfall.image_uris!.border_crop,
      scryfallUri: scryfall.scryfall_uri,
      text: { mana_cost: '{1}{R}' },
    });
  });

  it('keeps a snapshot, not a live card', () => {
    const log = useEventLogStore();
    const card = makeCard({ name: 'Before' });

    log.record('cast', { card });
    card.name = 'After';

    expect(cardName(log.entries[0])).toBe('Before');
  });

  it('records type-specific details', () => {
    const log = useEventLogStore();
    const host = makeCard({ name: 'Host' });

    const entry = log.record('attached', {
      card: makeCard(),
      target: host,
    });

    expect(entry.target).toMatchObject({ instanceId: host.id, name: 'Host' });
  });

  it('starts a new game with a marker', () => {
    const log = useEventLogStore();
    const first = log.gameId;

    const marker = log.startNewGame('newGame');

    expect(log.gameId).not.toBe(first);
    expect(marker).toMatchObject({
      type: 'gameMarker',
      reason: 'newGame',
      gameId: log.gameId,
    });
  });

  it('keeps only the current game; a new game archives the rest', async () => {
    const log = useEventLogStore();
    log.record('fetched', { card: makeScryfallCard({ name: 'Last game' }) });

    log.startNewGame('newGame');
    log.record('fetched', { card: makeScryfallCard({ name: 'This game' }) });
    await log.settled();

    expect(log.entries.map((e) => e.type)).toEqual(['gameMarker', 'fetched']);
    await log.loadHistory();
    expect(log.history.map(cardName)).toEqual([
      'Last game',
      undefined,
      'This game',
    ]);
  });

  it('when the current game fills, keeps only the newest 250 of a recent game', () => {
    const log = useEventLogStore();
    for (let i = 0; i <= MAX_ENTRIES; i++) log.record('boardCleared', {});

    expect(log.entries).toHaveLength(250);
  });

  it('when the current game fills, drops everything over a day old if that drops more', () => {
    vi.useFakeTimers({ now: new Date('2026-11-07T12:00:00Z') });
    const log = useEventLogStore();
    for (let i = 0; i < MAX_ENTRIES - 100; i++) log.record('boardCleared', {});

    vi.setSystemTime(Date.now() + 25 * 60 * 60 * 1000);
    for (let i = 0; i <= 100; i++) log.record('boardCleared', {});

    expect(log.entries).toHaveLength(101);
  });

  it('says when the current game is nearly full', () => {
    const log = useEventLogStore();
    for (let i = 1; i < NEARLY_FULL_ENTRIES; i++)
      log.record('boardCleared', {});
    expect(log.nearlyFull).toBe(false);

    log.record('boardCleared', {});
    expect(log.nearlyFull).toBe(true);
  });

  it('archives a finished game on the next start if the tab closed first', async () => {
    const log = useEventLogStore();
    log.record('fetched', { card: makeScryfallCard({ name: 'Last game' }) });
    log.startNewGame('newGame');
    await nextTick();
    flushSaves(); // The tab closes before the archive write lands.

    setActivePinia(createPinia());
    const reloaded = useEventLogStore();
    await reloaded.settled();
    await reloaded.loadHistory();

    expect(reloaded.history.map(cardName)).toContain('Last game');
    expect(reloaded.history.filter((e) => e.type === 'fetched')).toHaveLength(
      1,
    );
  });

  it('clear history empties the archive but keeps the current game', async () => {
    const log = useEventLogStore();
    log.record('fetched', { card: makeScryfallCard({ name: 'Last game' }) });
    log.startNewGame('newGame');
    await log.settled();

    log.clearHistory();
    await log.settled();
    await log.loadHistory();

    expect(log.history.map((e) => e.type)).toEqual(['gameMarker']);
  });

  it('reset empties the archive too', async () => {
    const log = useEventLogStore();
    log.record('fetched', { card: makeScryfallCard() });
    log.startNewGame('newGame');
    await log.settled();

    log.reset();
    await log.settled();
    await log.loadHistory();

    expect(log.history).toEqual([]);
  });

  it('without IndexedDB, keeps the current game only and says so', async () => {
    Reflect.deleteProperty(globalThis, 'indexedDB');
    const log = useEventLogStore();
    log.record('fetched', { card: makeScryfallCard({ name: 'Last game' }) });

    log.startNewGame('newGame');
    await log.settled();
    await log.loadHistory();

    expect(log.archiveAvailable).toBe(false);
    expect(log.history.map((e) => e.type)).toEqual(['gameMarker']);
  });

  it('survives a reload, game included', async () => {
    const log = useEventLogStore();
    log.startNewGame('newGame');
    log.record('cast', { card: makeCard({ name: 'Kept' }) });
    const gameId = log.gameId;
    await nextTick();
    flushSaves();

    setActivePinia(createPinia());
    const reloaded = useEventLogStore();

    expect(reloaded.entries.map((e) => e.type)).toEqual(['gameMarker', 'cast']);
    expect(reloaded.gameId).toBe(gameId);
  });

  it('saves each card once, however many entries mention it', async () => {
    const log = useEventLogStore();
    const card = makeCard({ name: 'Mentioned Often' });
    const host = makeCard({ name: 'Host' });
    log.record('cast', { card });
    log.record('attached', { card, target: host });
    log.record('removed', { card });
    await nextTick();
    flushSaves();

    // devalue writes an object once and refers back to it after that.
    const saved = localStorage.getItem('mtg-harmony_eventLog')!;
    expect(saved.match(/"instanceId":/g)).toHaveLength(2); // card and host

    setActivePinia(createPinia());
    const [cast, attached] = useEventLogStore().entries;
    expect(cardName(cast)).toBe('Mentioned Often');
    expect(cast && 'card' in cast && cast.card).toBe(
      attached && 'card' in attached && attached.card,
    );
  });

  it("doesn't wrap entries in Vue's reactivity, which costs on every event (#81)", () => {
    const log = useEventLogStore();
    log.record('cast', { card: makeCard() });

    expect(isProxy(log.entries[0])).toBe(false);
  });

  it('still updates anything that reads the entries', () => {
    const log = useEventLogStore();
    const count = computed(() => log.entries.length);
    expect(count.value).toBe(0);

    log.record('cast', { card: makeCard() });
    expect(count.value).toBe(1);

    log.reset();
    expect(count.value).toBe(0);
  });

  it('keeps cards that are still on the board apart from new instances', () => {
    const log = useEventLogStore();
    const first = makeCard({ name: 'Twin' });
    const second = { ...first, id: 'another-instance' };

    log.record('cast', { card: first });
    log.record('cast', { card: second });

    const ids = log.entries.map((e) =>
      'card' in e ? e.card.instanceId : undefined,
    );
    expect(ids).toEqual([first.id, 'another-instance']);
  });

  it('ignores saved entries that are not entries', () => {
    localStorage.setItem(
      'mtg-harmony_eventLog',
      // devalue's format for a plain object
      '[{"entries":1,"gameId":3},[2],"junk","game-1"]',
    );

    const log = useEventLogStore();

    expect(log.entries).toEqual([]);
    expect(log.gameId).toBe('game-1');
  });

  it('reset empties the log and starts a new game', () => {
    const log = useEventLogStore();
    log.record('boardCleared', {});
    const before = log.gameId;

    log.reset();

    expect(log.entries).toEqual([]);
    expect(log.gameId).not.toBe(before);
  });
});
