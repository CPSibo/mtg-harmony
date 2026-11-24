// Fails a PR whose version isn't one bump from its base branch's (#168).
// Usage: node scripts/version/check.mjs <base ref>, e.g. origin/dev.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { checkBump } from './bump.mjs';

const baseRef = process.argv[2];
if (!baseRef) {
  console.error('Usage: node scripts/version/check.mjs <base ref>');
  process.exit(2);
}

const read = (file) => JSON.parse(readFileSync(file, 'utf8'));
const base = JSON.parse(
  execFileSync('git', ['show', `${baseRef}:package.json`], {
    encoding: 'utf8',
  }),
).version;
const { version } = read('package.json');
const lock = read('package-lock.json');

const problems = [checkBump(base, version)];
if (lock.version !== version || lock.packages?.['']?.version !== version) {
  problems.push(
    `package-lock.json's version doesn't match package.json's ${version}. ` +
      'Bump with npm version <x.y.z> --no-git-tag-version, which updates both.',
  );
}

const failed = problems.filter(Boolean);
for (const problem of failed) console.error(problem);
if (failed.length) process.exit(1);
console.log(`Version ${base} -> ${version}`);
