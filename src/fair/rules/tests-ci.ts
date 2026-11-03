import { errorClassOf, unknownResult } from '../errors.ts';
import type { Rule } from '../types.ts';
import { absentOrUnknown, repoPath, resultFor, type DirEntry } from './shared.ts';

const result = resultFor('tests_ci');

const TEST_DIRS = new Set(['tests', 'test']);
/** Root-level CI config other than GitHub Actions. */
const CI_FILES = new Set(['.travis.yml', '.gitlab-ci.yml', 'azure-pipelines.yml', 'Jenkinsfile', '.circleci', 'appveyor.yml', '.appveyor.yml']);

const LOOKS_LIKE_CI = /test|\bci\b|ci\.|build|check/i;

/** tests/CI: a `tests/` or `test/` folder, or a CI workflow file. */
export const testsCi: Rule = {
  indicator: 'tests_ci',
  title: 'Tests/CI',
  async check(repo, gh) {
    const res = await gh.request('GET', repoPath(repo, '/contents'));
    if (res.status !== 200) return absentOrUnknown('tests_ci', res, repo, gh, 'Repository has no files');
    const root = res.data as DirEntry[];

    const testDir = root.find((e) => e.type === 'dir' && TEST_DIRS.has(e.name));
    if (testDir) return result('met', testDir.html_url, `${testDir.name}/ folder found`);

    if (root.some((e) => e.type === 'dir' && e.name === '.github')) {
      const wf = await gh.request('GET', repoPath(repo, '/contents/.github/workflows'));
      if (wf.status === 200) {
        const workflows = (wf.data as DirEntry[]).filter((e) => e.type === 'file' && /\.ya?ml$/.test(e.name));
        // Any workflow counts; one that looks like CI makes the better evidence link.
        const workflow = workflows.find((e) => LOOKS_LIKE_CI.test(e.name)) ?? workflows[0];
        if (workflow) return result('met', workflow.html_url, `CI workflow ${workflow.path}`);
      } else if (wf.status !== 404) {
        return unknownResult('tests_ci', errorClassOf(wf));
      }
    }

    const ci = root.find((e) => CI_FILES.has(e.name));
    if (ci) return result('met', ci.html_url, `CI config ${ci.name}`);

    return result('unmet', repo.url, 'No tests/ or test/ folder and no CI workflow found');
  },
};
