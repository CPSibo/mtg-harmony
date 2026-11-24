import { flushPromises } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEventLogStore } from '~/features/eventLog';
import ExportLogModal from '~/features/eventLog/components/ExportLogModal.vue';
import { makeCard, makeScryfallCard } from '../../fixtures/cards';
import { buttonNamed, mountInApp, unmountAll } from '../../fixtures/mount';

const toasts: { title?: string; color?: string }[] = [];
vi.mock('@nuxt/ui/composables', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@nuxt/ui/composables')>()),
  useToast: () => ({
    add: (toast: (typeof toasts)[number]) => toasts.push(toast),
  }),
}));

async function openModal() {
  mountInApp(ExportLogModal, { props: { open: true } });
  await flushPromises();
}

const summary = () =>
  document.body.textContent?.match(/Matches [\d,]+ \w+/)?.[0];

describe('ExportLogModal (#171)', () => {
  beforeEach(() => {
    toasts.length = 0;
  });
  afterEach(unmountAll);

  it('counts the cards cast this game by default', async () => {
    const log = useEventLogStore();
    log.record('fetched', { card: makeScryfallCard({ name: 'Skipped' }) });
    log.record('cast', { card: makeCard({ name: 'Bear' }) });

    await openModal();

    expect(summary()).toBe('Matches 1 card');
  });

  it('counts events, not cards, for all events', async () => {
    const log = useEventLogStore();
    log.record('fetched', { card: makeScryfallCard({ name: 'Bear' }) });
    log.record('cast', { card: makeCard({ name: 'Bear' }) });
    await openModal();

    buttonNamed('All events').click();
    await flushPromises();

    expect(summary()).toBe('Matches 2 events');
    expect(buttonNamed('All events').getAttribute('aria-pressed')).toBe('true');
  });

  it('disables Copy and Download, saying why, when nothing matches', async () => {
    await openModal();

    for (const name of ['Copy', 'Download']) {
      expect(buttonNamed(name).disabled).toBe(true);
      expect(buttonNamed(name).title).toBe('No cards match these options');
    }
  });

  it('copies the export and says so', async () => {
    useEventLogStore().record('cast', { card: makeCard({ name: 'Bear' }) });
    const writeText = vi.fn(async () => {});
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    await openModal();

    buttonNamed('Copy').click();
    await flushPromises();

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Bear'));
    expect(toasts).toEqual([
      expect.objectContaining({ title: 'Copied to clipboard' }),
    ]);
  });

  it('says so when the clipboard refuses', async () => {
    useEventLogStore().record('cast', { card: makeCard({ name: 'Bear' }) });
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: { writeText: vi.fn(async () => Promise.reject(new Error())) },
    });
    await openModal();

    buttonNamed('Copy').click();
    await flushPromises();

    expect(toasts).toEqual([
      expect.objectContaining({ title: 'Could not copy', color: 'error' }),
    ]);
  });

  it('downloads a CSV named after the options', async () => {
    useEventLogStore().record('cast', { card: makeCard({ name: 'Bear' }) });
    const clicked: HTMLAnchorElement[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicked.push(this);
    });
    const blobs: Blob[] = [];
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      blobs.push(blob as Blob);
      return 'blob:export';
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    await openModal();

    buttonNamed('CSV').click();
    await flushPromises();
    buttonNamed('Download').click();

    expect(clicked).toHaveLength(1);
    expect(clicked[0]!.download).toMatch(
      /^mtg-harmony-cast-game-\d{4}-\d{2}-\d{2}\.csv$/,
    );
    expect(blobs[0]!.type).toBe('text/csv');
    expect(await blobs[0]!.text()).toContain(',cast,Bear,');
  });
});
