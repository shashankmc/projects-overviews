import { errorClassOf, unknownResult } from '../errors.ts';
import type { Rule } from '../types.ts';
import { repoPath, resultFor } from './shared.ts';

const result = resultFor('releases');

/** SemVer 2.0.0 (semver.org's regex), with an optional leading "v". */
const SEMVER =
  /^v?(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-(?:(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+[0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*)?$/;

/** versioned releases: at least one semver tag (first 100 tags, newest first). */
export const releases: Rule = {
  indicator: 'releases',
  title: 'Versioned releases',
  async check(repo, gh) {
    const res = await gh.request('GET', repoPath(repo, '/tags?per_page=100'));
    // A visible repo always answers 200 here (an empty list if untagged), so any other status is unknown.
    if (res.status !== 200) return unknownResult('releases', errorClassOf(res));
    const tags = (res.data as { name: string }[]).map((t) => t.name);
    const semver = tags.find((name) => SEMVER.test(name));
    if (semver) return result('met', `${repo.url}/releases/tag/${semver}`, `Semver tag ${semver}`);
    const detail = tags.length ? `${tags.length} tag(s), none semver` : 'No tags';
    return result('unmet', `${repo.url}/tags`, detail);
  },
};
