/**
 * The way out when the app can't start (#154), most likely because of saved
 * data this version can't read. Plain DOM, not Vue: Vue is what failed.
 */

const STORAGE_PREFIX = 'mtg-harmony_';
const DB_NAME = 'mtg-harmony';

/** Deletes everything the app saved: every `mtg-harmony_*` key and the log archive. */
export async function resetAppStorage(): Promise<void> {
  try {
    for (const key of Object.keys(localStorage))
      if (key.startsWith(STORAGE_PREFIX)) localStorage.removeItem(key);
  } catch (ex) {
    console.error('Could not clear saved data.', ex);
  }
  if (typeof indexedDB === 'undefined') return;
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = request.onerror = request.onblocked = () => resolve();
  });
}

function button(label: string, primary: boolean, onClick: () => void) {
  const el = document.createElement('button');
  el.type = 'button';
  el.textContent = label;
  el.className = primary
    ? 'rounded-md bg-red-600 px-3 py-2 font-medium text-white hover:bg-red-500'
    : 'rounded-md bg-zinc-800 px-3 py-2 font-medium text-zinc-100 hover:bg-zinc-700';
  el.addEventListener('click', onClick);
  return el;
}

/**
 * Covers the page with what went wrong, a **Reload** button and a **Reset
 * app data** button that clears what the app saved and reloads. Shown once.
 */
export function showStartupFailure(error: unknown): void {
  if (document.querySelector('[data-startup-failure]')) return;

  const panel = document.createElement('div');
  panel.dataset.startupFailure = '';
  panel.setAttribute('role', 'alertdialog');
  panel.setAttribute('aria-labelledby', 'startup-failure-title');
  panel.className =
    'fixed inset-0 z-[9999] flex items-center justify-center bg-zinc-950 p-6 text-zinc-100';

  const box = document.createElement('div');
  box.className = 'flex max-w-md flex-col gap-3';

  const title = document.createElement('h1');
  title.id = 'startup-failure-title';
  title.className = 'text-lg font-semibold';
  title.textContent = "MTG Harmony couldn't start";

  const text = document.createElement('p');
  text.className = 'text-sm text-zinc-300';
  text.textContent =
    'Its saved data may be from another version or damaged. Try reloading. ' +
    'If that doesn’t help, reset the app: this clears the board, On-deck, ' +
    'the event log and your settings.';

  const detail = document.createElement('pre');
  detail.className =
    'max-h-32 overflow-auto rounded bg-zinc-900 p-2 text-xs whitespace-pre-wrap text-zinc-400';
  detail.textContent =
    error instanceof Error ? error.message : String(error ?? 'Unknown error');

  const actions = document.createElement('div');
  actions.className = 'flex gap-2';
  actions.append(
    button('Reload', false, () => location.reload()),
    button('Reset app data', true, () => {
      void resetAppStorage().then(() => location.reload());
    }),
  );

  box.append(title, text, detail, actions);
  panel.append(box);
  document.body.append(panel);
}
