const VERSION = /^(\d+)\.(\d+)\.(\d+)$/;

/**
 * Why `head` isn't exactly one patch, minor or major bump from `base`, or
 * null if it is. Every PR to dev bumps the version once (see AGENTS.md).
 * @param {string} base The version on the PR's base branch.
 * @param {string} head The version on the PR's branch.
 * @returns {string | null}
 */
export function checkBump(base, head) {
  const [b, h] = [base, head].map((v) => VERSION.exec(v)?.slice(1).map(Number));
  if (!b) return `The base version ${base} is not x.y.z.`;
  if (!h) return `The version ${head} is not x.y.z.`;

  const [major, minor, patch] = b;
  const allowed = [
    `${major}.${minor}.${patch + 1}`,
    `${major}.${minor + 1}.0`,
    `${major + 1}.0.0`,
  ];
  if (allowed.includes(head)) return null;

  const which = head === base ? 'is the same as' : 'is not one bump from';
  return (
    `The version ${head} ${which} the base branch's ${base}. ` +
    `Bump it to ${allowed.join(', ')} (patch, minor or major), ` +
    `with npm version <x.y.z> --no-git-tag-version.`
  );
}
