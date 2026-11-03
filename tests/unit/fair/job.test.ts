import { describe, expect, it } from 'vitest';
import { runFairJob } from '../../../src/fair/job.ts';
import type { GitHubClient } from '../../../src/fair/types.ts';
import { fakeIssuesRepo } from './fake-issues.ts';
import { fixtureClient } from './fixture-client.ts';

const REPO = 'shashankmc/projects-overviews';

/** Issue calls go to the in-memory fake, everything else to recorded fixtures. */
function world() {
  const issues = fakeIssuesRepo(REPO);
  const recorded = fixtureClient('licence-met');
  const client: GitHubClient = {
    request: (method, path, body) =>
      path.startsWith(`/repos/${REPO}/issues`) ? issues.client.request(method, path, body) : recorded.request(method, path, body),
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
});
