/**
 * The one way to call Scryfall (#158). Scryfall allows about 2 requests a
 * second and bans IPs that keep exceeding it, so every request (On-deck,
 * Add Card search, Swap art) waits its turn in a single line, spaced
 * `MIN_REQUEST_INTERVAL_MS` apart. A line rather than a timestamp check:
 * concurrent callers that each read the last request time before any of
 * them updated it used to fire together.
 */

// Scryfall's docs specify a 2 req/s hard cap. 600ms keeps us under that
// with some margin instead of shaving it exactly to 500ms.
export const MIN_REQUEST_INTERVAL_MS = 600;

let line: Promise<void> = Promise.resolve();
let lastRequestTime = -Infinity;

const ignore = () => {};

/** Waits `ms`, or rejects as soon as `signal` aborts. */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(done, ms);
    function done() {
      signal?.removeEventListener('abort', aborted);
      resolve();
    }
    function aborted() {
      clearTimeout(timer);
      reject(signal!.reason);
    }
    signal?.addEventListener('abort', aborted, { once: true });
  });
}

async function waitForTurn(signal?: AbortSignal) {
  // A request cancelled while queued gives up its slot.
  signal?.throwIfAborted();
  const wait = lastRequestTime + MIN_REQUEST_INTERVAL_MS - Date.now();
  if (wait > 0) await sleep(wait, signal);
  lastRequestTime = Date.now();
}

/** `fetch`, after the previous Scryfall request plus the minimum interval. */
export function scryfallFetch(
  input: string | URL,
  init?: RequestInit,
): Promise<Response> {
  const turn = line.then(() => waitForTurn(init?.signal ?? undefined));
  // The next request waits for this one's turn, whether or not it's used.
  line = turn.then(ignore, ignore);
  return turn.then(() => fetch(input, init));
}
