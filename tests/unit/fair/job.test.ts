import { describe, expect, it } from 'vitest';
import { NetworkError } from '../../../src/fair/errors.ts';
import { runFairJob } from '../../../src/fair/job.ts';
import type { GitHubClient, Rule } from '../../../src/fair/types.ts';
import { fakeIssuesRepo } from './fake-issues.ts';
import { fixtureClient } from './fixture-client.ts';

const REPO = 'shashankmc/projects-overviews';

/**
 * Issue calls go to the in-memory fake, everything else to recorded fixtures.
 * Unrecorded calls fail the way an unreachable GitHub would (NetworkError).
 */
function world() {
  const issues = fakeIssuesRepo(REPO);
  const recorded = fixtureClient('licence-met');
  const client: GitHubClient = {
    request: async (method, path, body) => {
      if (path.startsWith(`/repos/${REPO}/issues`)) return issues.client.request(method, path, body);
      try {
        return await recorded.request(method, path, body);
      } catch {
        throw new NetworkError('unrecorded');
      }
    },
  };
  return { client, issues: issues.issues };
}

const registry = {
  projects: [
    { id: 'p1', name: 'Am AI Right' },
    { id: 'p2', name: 'CLE', repos: ['https://github.com/cli/cli'] },
  ],
};

describe('runFairJob (nightly run)', () => {
  it('writes one rolling issue with the licence evidence and the projects lacking repos', async () => {
    const w = world();
    await runFairJob({ registry, gh: w.client, repo: REPO, now: new Date('2026-11-03T02:00:00Z') });
    expect(w.issues).toHaveLength(1);
    const [issue] = w.issues;
    expect(issue!.labels).toEqual([{ name: 'fair-report' }]);
    expect(issue!.body).toContain('_No repos listed._');
    expect(issue!.body).toContain('| Licence | met | [evidence](https://github.com/cli/cli/blob/trunk/LICENSE)');
  });

  it('two nightly runs leave exactly one open issue, carrying the second run', async () => {
    const w = world();
    await runFairJob({ registry, gh: w.client, repo: REPO, now: new Date('2026-11-03T02:00:00Z') });
    await runFairJob({ registry, gh: w.client, repo: REPO, now: new Date('2026-11-04T02:00:00Z') });
    expect(w.issues.filter((i) => i.state === 'open')).toHaveLength(1);
    expect(w.issues[0]!.body).toContain('2026-11-04T02:00:00.000Z');
  });

  it('shows all 12 indicators for each checked repo, unknown where nothing was recorded', async () => {
    const w = world();
    await runFairJob({ registry, gh: w.client, repo: REPO, now: new Date('2026-11-03T02:00:00Z') });
    const body = w.issues[0]!.body;
    expect(body).toContain('[cli/cli](https://github.com/cli/cli): FAIR evidence 1 of 12 automatable (11 unknown)');
    for (const title of ['Licence', 'CITATION.cff', 'codemeta.json', 'DOI-bearing release', 'Registry presence', 'README and docs',
      'Install instructions', 'Tests/CI', 'Versioned releases', 'Declared dependencies', 'Contributing guide', 'Recent activity']) {
      expect(body).toContain(`| ${title} | `);
    }
  });

  it('fails loudly on an internal error, but only after writing the issue that shows it', async () => {
    const w = world();
    const buggy: Rule = {
      indicator: 'buggy',
      title: 'Buggy',
      check: async () => {
        throw new TypeError('x is not a function');
      },
    };
    await expect(runFairJob({ registry, gh: w.client, repo: REPO, rules: [buggy], now: new Date('2026-11-03T02:00:00Z') })).rejects.toThrow(
      'internal_error in 1 check(s): https://github.com/cli/cli buggy',
    );
    expect(w.issues).toHaveLength(1);
    expect(w.issues[0]!.body).toContain('| Buggy | unknown | Could not check (internal_error) |');
  });

  it('does not fail the run for network errors and timeouts: they are ordinary unknowns', async () => {
    const w = world();
    const result = await runFairJob({ registry, gh: w.client, repo: REPO, now: new Date('2026-11-03T02:00:00Z') });
    expect(result.report.internal_errors).toEqual([]);
  });
});
