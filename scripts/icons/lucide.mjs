// Writes app/assets/icons/lucide.json: the Lucide icons the app and Nuxt UI
// use, so they ship in the bundle instead of coming from the Iconify API at
// runtime (#100). Run with `npm run icons:lucide` after adding an icon.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Run from the repo root (npm scripts and Vitest both do).
const root = process.cwd();
const NAME = /i-lucide-([a-z0-9-]+)/g;

function* files(dir, ext) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* files(path, ext);
    else if (ext.some((e) => entry.name.endsWith(e))) yield path;
  }
}

/** Icon names used in `dir`'s files. */
export function usedIcons(dir, ext) {
  const names = new Set();
  for (const file of files(dir, ext))
    for (const [, name] of readFileSync(file, 'utf8').matchAll(NAME))
      names.add(name);
  return names;
}

/** The app's icons plus Nuxt UI's defaults (close buttons, chevrons, …). */
export function neededIcons() {
  return new Set([
    ...usedIcons(join(root, 'app'), ['.vue', '.ts']),
    ...usedIcons(join(root, 'node_modules/@nuxt/ui/dist/shared'), ['.mjs']),
  ]);
}

if (process.argv[1]?.endsWith('lucide.mjs')) {
  const set = JSON.parse(
    readFileSync(join(root, 'node_modules/@iconify-json/lucide/icons.json')),
  );
  const out = {
    prefix: 'lucide',
    width: set.width,
    height: set.height,
    icons: {},
    aliases: {},
  };
  for (const name of [...neededIcons()].sort()) {
    if (set.icons[name]) out.icons[name] = set.icons[name];
    else if (set.aliases?.[name]) {
      out.aliases[name] = set.aliases[name];
      const parent = set.aliases[name].parent;
      out.icons[parent] = set.icons[parent];
    } else throw new Error(`No Lucide icon named "${name}".`);
  }
  const file = join(root, 'app/assets/icons/lucide.json');
  writeFileSync(file, JSON.stringify(out) + '\n');
  console.log(`Wrote ${Object.keys(out.icons).length} icons to ${file}`);
}
