/**
 * Patches third-party packages that have not yet been updated for the current
 * version of Vitest. Run automatically via the `postinstall` npm script.
 *
 * Each entry describes the file to patch, the string to find, and its
 * replacement. The script is idempotent — it silently skips files where the
 * target string is not present (already patched, or the package was updated).
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const root = fileURLToPath(new URL('..', import.meta.url))

const patches = [
  {
    // @nuxt/test-utils 4.0.0 imports populateGlobal from 'vitest/environments',
    // which was deprecated in Vitest 4.1 in favour of 'vitest/runtime'.
    // https://github.com/nuxt/test-utils/issues/???  (pending upstream fix)
    file: 'node_modules/@nuxt/test-utils/dist/vitest-environment.mjs',
    from: "from 'vitest/environments'",
    to:   "from 'vitest/runtime'",
  },
]

for (const { file, from, to } of patches) {
  const filePath = join(root, file)
  const original = readFileSync(filePath, 'utf8')
  const patched = original.replaceAll(from, to)

  if (patched === original) {
    console.log(`patch-deps: already patched or pattern not found — ${file}`)
  } else {
    writeFileSync(filePath, patched)
    console.log(`patch-deps: applied patch to ${file}`)
  }
}
