import { describe, expect, it } from 'vitest';
import {
  describeGroup,
  groupRows,
  useEventLogStore,
} from '~/features/eventLog';
import { makeCard } from '../../fixtures/cards';

describe('grouped log entries (#221)', () => {
  it('gives the entries recorded in one group the same group ID', () => {
    const log = useEventLogStore();
    log.record('removed', { card: makeCard() });
    log.group(() => {
      log.record('removed', { card: makeCard() });
      log.record('removed', { card: makeCard() });
    });
    log.record('removed', { card: makeCard() });

    const [before, a, b, after] = log.entries;
    expect(before!.groupId).toBeUndefined();
    expect(a!.groupId).toBeTruthy();
    expect(b!.groupId).toBe(a!.groupId);
    expect(after!.groupId).toBeUndefined();
  });

  it('folds a group into one row, keeping single entries apart', () => {
    const log = useEventLogStore();
    log.record('removed', { card: makeCard() });
    log.group(() => {
      log.record('removed', { card: makeCard() });
      log.record('removed', { card: makeCard() });
    });
    // A group of one is just an entry.
    log.group(() => log.record('removed', { card: makeCard() }));

    const rows = groupRows([...log.entries].reverse());
    expect(
      rows.map((r) => (r.kind === 'group' ? r.entries.length : 1)),
    ).toEqual([1, 2, 1]);
  });

  it.each([
    ['removed', 'Removed 2 cards'],
    ['copied', 'Copied 2 cards (with counters)'],
  ] as const)('describes a group of %s entries', (type, text) => {
    const log = useEventLogStore();
    log.group(() => {
      for (let i = 0; i < 2; i++) {
        const card = makeCard();
        if (type === 'removed') log.record('removed', { card });
        else log.record('copied', { card, source: card, mode: 'counters' });
      }
    });
    expect(describeGroup(log.entries)).toBe(text);
  });
});
