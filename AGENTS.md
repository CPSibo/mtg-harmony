# MTG Harmony

A static web app for playing [Discord, Lord of Disharmony](https://scryfall.com/card/sld/798/discord-lord-of-disharmony)
at the table: fetch random cards from Scryfall, cast them as tokens onto a pan-and-zoom board, and track them there.
Client-only (Nuxt 4 with `ssr: false` today), state saved to `localStorage`.

These instructions add to the shared `AGENTS.md` one folder up and win where they disagree.

**Entry document:** [README.md](README.md). Domain terms: [docs/domain.md](docs/domain.md).

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

## Definition of Done

```bash
npm run format        # then commit any changes it makes
npm run lint
npm run typecheck
npm test
npm run generate      # production build into dist/
```

There are no unit tests yet, so `npm test` runs Vitest with `--passWithNoTests` until #18 adds them. End-to-end
tests (`npm run test:e2e`) and their CI job are paused until #19.

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
- The app is leaving Nuxt for plain Vite + Vue 3 + Nuxt UI + Pinia + VueUse (milestone M2). Don't add new
  dependencies on Nuxt-only features (Nuxt modules, `#app`/`#imports` APIs, server routes) beyond what a fix needs.
- Renovate stays off until the project is stable.
