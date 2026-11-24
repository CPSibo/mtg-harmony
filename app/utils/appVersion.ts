/** `v1.0.0 (abc1234)`, or just `v1.0.0` when the build knew no commit. */
export function formatVersion(version: string, commit: string): string {
  return commit ? `v${version} (${commit})` : `v${version}`;
}

/**
 * This build's version, for bug reports (#168). Vite fills both in at build
 * time; see `buildInfo()` in `vite.config.ts`.
 */
export const APP_VERSION = formatVersion(__APP_VERSION__, __APP_COMMIT__);
