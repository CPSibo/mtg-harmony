# MTG Harmony

A static web app for playing [Discord, Lord of Disharmony](https://scryfall.com/card/sld/798/discord-lord-of-disharmony)
at the table: fetch random cards from Scryfall, cast them as tokens onto a pan-and-zoom board, and track them there.
Client-only (Nuxt 4 with `ssr: false` today), state saved to `localStorage`.

These instructions add to the shared `AGENTS.md` one folder up and win where they disagree.

**Entry document:** [README.md](README.md). Domain terms: [docs/domain.md](docs/domain.md).

## Work cycle

Follow these steps for every work item (a GitHub issue):

1. `git fetch origin`, then create a branch from `origin/dev` (see [Branches](#branches-and-deploys)).
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
npx vitest run
npm run generate      # production build into dist/
```

Lint currently fails on `dev` (#13) and there are no unit tests yet (#14, #18).

## Branches and deploys

- `dev` is the trunk. PRs target `dev` and are squash-merged by the owner. Never push to `dev` or `main`.
- Branch names: `<type>/<issue>-<slug>`, e.g. `feat/33-copy-variants`, `bug/24-duplicate-card-ids`. Types: `feat`,
  `bug`, `docs`, `chore`, `refactor`, `test`.
- Cloudflare Pages builds through its git integration: `main` deploys to mtg-harmony.com, `dev` to
  dev.mtg-harmony.com. Neither has users yet, so work targets `dev` only; the owner releases to `main`.
- Work items are GitHub issues, grouped by milestone and labelled by type and `area:*`.

## Owner decisions (don't relitigate)

- Every card on the board is a token. There is no library, hand, graveyard or exile, so don't add zones.
- The app is leaving Nuxt for plain Vite + Vue 3 + Nuxt UI + Pinia + VueUse (milestone M2). Don't add new
  dependencies on Nuxt-only features (Nuxt modules, `#app`/`#imports` APIs, server routes) beyond what a fix needs.
- Renovate stays off until the project is stable.
