import { describe, expect, it } from 'vitest';
import {
  describeEntry,
  filterEntries,
  scryfallCardFromSnapshot,
  useEventLogStore,
  type EventEntry,
} from '~/features/eventLog';
import { makeCard, makeScryfallCard } from '../../fixtures/cards';

function sampleLog() {
  const log = useEventLogStore();
  const ooze = makeCard({ name: 'Smoke Ooze' });
  const host = makeCard({ name: 'Grizzly Host' });
  log.record('fetched', { card: makeScryfallCard({ name: 'Smoke Ooze' }) });
  log.record('cast', { card: ooze });
  log.record('attached', { card: ooze, target: host });
  log.record('copied', {
    card: makeCard({ name: 'Grizzly Host' }),
    source: host,
    mode: 'stack',
  });
  log.record('boardCleared', {});
  return log.entries;
}

describe('filterEntries', () => {
  it('lists every entry, newest first, with no filter', () => {
    const entries = sampleLog();

    expect(filterEntries(entries, {}).map((e) => e.type)).toEqual([
      'boardCleared',
      'copied',
      'attached',
      'cast',
      'fetched',
    ]);
  });

  it('keeps only the chosen types', () => {
    const types = filterEntries(sampleLog(), {
      types: ['cast', 'fetched'],
    }).map((e) => e.type);

    expect(types).toEqual(['cast', 'fetched']);
  });

  it('matches part of any card name in the entry, ignoring case', () => {
    const types = filterEntries(sampleLog(), { name: 'grizzly' }).map(
      (e) => e.type,
    );

    expect(types).toEqual(['copied', 'attached']);
  });

  it('combines both filters', () => {
    const types = filterEntries(sampleLog(), {
      name: 'ooze',
      types: ['attached', 'copied'],
    }).map((e) => e.type);

    expect(types).toEqual(['attached']);
  });
});

describe('describeEntry', () => {
  it('says what happened in words', () => {
    const log = useEventLogStore();
    sampleLog();
    log.record('putUnder', {
      card: makeCard({ name: 'A' }),
      target: makeCard({ name: 'B' }),
    });
    log.record('removed', { card: makeCard({ name: 'C' }) });
    log.record('added', { card: makeCard({ name: 'D' }) });
    log.startNewGame('newGame');

    expect(log.history.map((e: EventEntry) => describeEntry(e))).toEqual([
      'Fetched Smoke Ooze',
      'Cast Smoke Ooze',
      'Attached Smoke Ooze to Grizzly Host',
      'Copied Grizzly Host (everything)',
      'Cleared the board',
      'Put A under B',
      'Removed C',
      'Added D',
      'New game (from the menu)',
    ]);
  });
});

describe('scryfallCardFromSnapshot', () => {
  it('rebuilds enough of a Scryfall card to cast it again', () => {
    const original = makeScryfallCard({ name: 'Again' });
    const log = useEventLogStore();
    const entry = log.record('fetched', { card: original });

    const card = scryfallCardFromSnapshot(entry.card);

    expect(card).toMatchObject({
      id: original.id,
      name: 'Again',
      scryfall_uri: original.scryfall_uri,
      image_uris: { border_crop: original.image_uris!.border_crop },
    });
  });
});

describe('event log window', () => {
  it('opens and closes', () => {
    const log = useEventLogStore();

    log.openWindow();
    expect(log.windowIsOpen).toBe(true);
    log.closeWindow();
    expect(log.windowIsOpen).toBe(false);
  });
});
