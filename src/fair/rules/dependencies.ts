import type { Rule } from '../types.ts';
import { absentOrUnknown, repoPath, resultFor, type DirEntry } from './shared.ts';

const result = resultFor('dependencies');

/** Root-level dependency manifests, in the order they are preferred as evidence. */
const MANIFESTS: RegExp[] = [
  /^pyproject\.toml$/,
  /^requirements(?:[-_.][\w.-]+)?\.txt$/,
  /^package\.json$/,
  /^DESCRIPTION$/,
  /^environment\.ya?ml$/,
];

/** declared dependencies: a manifest exists (pyproject, requirements, package.json, DESCRIPTION, environment.yml). */
export const dependencies: Rule = {
  indicator: 'dependencies',
  title: 'Declared dependencies',
  async check(repo, gh) {
    const res = await gh.request('GET', repoPath(repo, '/contents'));
    if (res.status !== 200) return absentOrUnknown('dependencies', res, repo, gh, 'Repository has no files');
    const files = (res.data as DirEntry[]).filter((e) => e.type === 'file');
    for (const pattern of MANIFESTS) {
      const manifest = files.find((e) => pattern.test(e.name));
      if (manifest) return result('met', manifest.html_url, `${manifest.name} declares dependencies`);
    }
    return result('unmet', repo.url, 'No dependency manifest at the repo root');
  },
};
