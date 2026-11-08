# MTG Harmony

A static web app for playing [Discord, Lord of Disharmony](https://scryfall.com/card/sld/798/discord-lord-of-disharmony)
at the table: fetch random cards from Scryfall, cast them as tokens onto a pan-and-zoom board, and track them there.
Client-only (Vite + Vue 3 + Nuxt UI + Pinia + VueUse), state saved to `localStorage`.

These instructions add to the shared `AGENTS.md` one folder up and win where they disagree.

**Entry document:** [docs/architecture.md](docs/architecture.md). Domain terms: [docs/domain.md](docs/domain.md).
Player-facing overview: [README.md](README.md).

## Work cycle

Follow these steps for every work item (a GitHub issue):

1. `git fetch origin --prune`, then create a branch from `origin/dev` (see [Branches](#branches-and-deploys)). If
   the branch you were on shows `[gone]` in `git branch -vv` and `gh pr view <branch> --json state` says `MERGED`,
   delete it locally with `git branch -D <branch>`. Squash merges mean `git branch -d` always refuses, so check
   the PR state instead of relying on it.
2. Read the issue and the relevant docs and code.
3. Plan the work.
4. Ask any clarifying questions before starting, and wait for the answers.
5. Write red-green unit tests for the work: failing first, then passing. Skip this step when the change has nothing
   unit-testable (docs, config, CI), and say so in the PR.
6. Implement the work.
7. Run every check in the [Definition of Done](#definition-of-done) locally.
8. `git fetch origin` and merge `origin/dev` again in case anything landed meanwhile. If anything came in, re-run
   step 7.
9. Push the branch and open a **draft** PR against `dev`. Link the issue (`Closes #N`) and any other issues, docs or
   artefacts of note.
10. Before handing the task back, stop everything you started: dev and preview servers, background processes,
    containers, and browser tabs or panes. Check nothing still listens on the ports you used (`3000`, `4173`,
    `5173`), and delete temporary files outside the scratchpad. Stopping a background task can leave its child
    process running, so check the port rather than trusting the task's status.

## Definition of Done

```bash
npm run format        # then commit any changes it makes
npm run lint
npm run typecheck
npm test
npm run build         # production build into dist/
```

`npm run test:e2e` runs the Playwright tests (CI runs them too). Run `npx playwright install chromium` once first.

## Unit tests

- Vitest, in `test/unit/` mirroring `app/`. The config reuses `vite.config.ts`, so imports resolve as in the app.
- Tests run in happy-dom. `test/unit/setup.ts` gives each test empty `localStorage`, an empty IndexedDB
  (`fake-indexeddb`; happy-dom has none), real timers and a fresh Pinia, so a store created in a test starts from
  its defaults. Await the event log's `settled()` before checking its archive.
- Mock Scryfall at the module boundary (`vi.mock('~/composables/useScryfall', …)`). Tests never hit the network.
- Build cards with `test/unit/fixtures/cards.ts`. To watch or break storage writes, use `stubStorage()` from
  `test/unit/fixtures/storage.ts`; spying on `Storage.prototype` leaks between tests under happy-dom.
- A test for a known, unfixed bug asserts the correct behaviour and is marked `it.fails`, with the issue number
  in its name. When the fix lands it fails loudly; change it to `it`.

## End-to-end tests

- Playwright, in `test/e2e/`, Chromium only. It runs against `vite preview` of a fresh production build on port
  4173, not the dev server.
- Locally Playwright reuses whatever already listens on 4173, which may be a stale build. Stop old preview
  servers before running it.
- Mock Scryfall with `page.route` (see `mockScryfall` in `test/e2e/smoke.spec.ts`): API calls and card images.
  Tests never hit the network.
- Prefer role-based locators (`getByRole`). Board cards expose `role="img"` named after the card.
- A test blocked by a known bug uses `test.fixme(true, '…: #N')`.

## Node version

- `.node-version` is the single source of the Node version. CI reads it (`node-version-file`), Cloudflare Pages
  reads it, and fnm uses it locally. Don't set a `NODE_VERSION` variable in the Pages project: it overrides the
  file. `package.json` `engines` mirrors it but nothing reads it for version selection.
- A major-only value works everywhere: Cloudflare's build image (asdf/node-build) installs the newest release of
  that major, and brings its own npm 10 rather than the npm bundled with Node.
- Check `node -v` before running the Definition of Done; it must be 26.x.
- npm 12 (bundled with Node 26) refuses to re-resolve one optional Tailwind package (`EALLOWREMOTE` on
  `@tailwindcss/oxide-wasm32-wasi`). `npm ci` is unaffected. When changing dependencies, run
  `npm install --allow-remote=all`.

## Imports

There are no auto-imports. Import every component, composable and Vue API explicitly; `~` points to `app/`.

- Nuxt UI components come from `@nuxt/ui/components/<Name>.vue` and composables from `@nuxt/ui/composables`.
- `UIcon` is the exception: import it from `@nuxt/ui/runtime/vue/components/Icon.vue`. The `components/` copy is
  the Nuxt variant and breaks the build. The same applies to `ULink` (`runtime/vue/overrides/none/Link.vue`).
- Nuxt UI's types declare a global `$fetch` that doesn't exist at runtime, so typecheck accepts it. ESLint rejects
  it; use `fetch()`.

## Branches and deploys

- `dev` is the trunk. PRs target `dev` and are squash-merged by the owner. Never push to `dev` or `main`.
- Branch names: `<type>/<issue>-<slug>`, e.g. `feat/33-copy-variants`, `bug/24-duplicate-card-ids`. Types: `feat`,
  `bug`, `docs`, `chore`, `refactor`, `test`.
- GitHub deletes a PR's remote branch when it merges. Local branches are cleaned up in step 1 of the work cycle.
- Cloudflare Pages builds through its git integration: `main` deploys to mtg-harmony.com, `dev` to
  dev.mtg-harmony.com. Neither has users yet, so work targets `dev` only; the owner releases to `main`.
- Work items are GitHub issues, grouped by milestone and labelled by type and `area:*`.

## Owner decisions (don't relitigate)

- Every card on the board is a token. There is no library, hand, graveyard or exile, so don't add zones.
- The app is plain Vite + Vue 3, not Nuxt. Don't bring back Nuxt-only features (Nuxt modules, auto-imports,
  `#app`/`#imports` APIs, file-based routing).
- Renovate stays off until the project is stable.
