import { describe, expect, it } from 'vitest';
import { testsCi } from '../../../src/fair/rules/tests-ci.ts';
import type { GitHubClient } from '../../../src/fair/types.ts';
import { fixtureClient, offlineContext, overriding, repo } from './fixture-client.ts';

const requests = repo('psf', 'requests');

/** psf/requests with its root listing filtered, to isolate one kind of evidence. */
async function requestsWithout(drop: (name: string) => boolean): Promise<GitHubClient> {
  const gh = fixtureClient('contents-psf-requests');
  const root = await gh.request('GET', '/repos/psf/requests/contents');
  const kept = (root.data as { name: string }[]).filter((e) => !drop(e.name));
  return overriding(gh, { 'GET /repos/psf/requests/contents': { status: 200, data: kept } });
}

describe('tests/CI rule', () => {
  it('is met when the repo has a tests/ folder, linking it', async () => {
    const result = await testsCi.check(requests, fixtureClient('contents-psf-requests'), offlineContext());
    expect(result).toMatchObject({
      indicator: 'tests_ci',
      state: 'met',
      evidence_url: 'https://github.com/psf/requests/tree/main/tests',
    });
  });

  it('is met by a GitHub Actions workflow when there is no tests folder, linking the workflow', async () => {
    const result = await testsCi.check(requests, await requestsWithout((n) => n === 'tests'), offlineContext());
    expect(result.state).toBe('met');
    // Prefers a workflow that looks like CI over e.g. close-issues.yml, which sorts first.
    expect(result.evidence_url).toBe('https://github.com/psf/requests/blob/main/.github/workflows/run-tests.yml');
  });

  it('is unmet when there is neither a tests folder nor CI config, linking the repo', async () => {
    const result = await testsCi.check(repo('octocat', 'Hello-World'), fixtureClient('contents-octocat'), offlineContext());
    expect(result).toMatchObject({ state: 'unmet', evidence_url: 'https://github.com/octocat/Hello-World' });
  });

  it('is unknown, not unmet, when the workflows folder cannot be listed', async () => {
    const gh = overriding(await requestsWithout((n) => n === 'tests'), {
      'GET /repos/psf/requests/contents/.github/workflows': { status: 502, data: null },
    });
    const result = await testsCi.check(requests, gh, offlineContext());
    expect(result).toMatchObject({ state: 'unknown', detail: expect.stringContaining('upstream_error') });
  });

  it('is unknown when the listed repo cannot be found', async () => {
    const result = await testsCi.check(
      repo('octocat', 'this-repo-does-not-exist-xyz'),
      fixtureClient('contents-repo-not-found'),
      offlineContext(),
    );
    expect(result).toMatchObject({ state: 'unknown', evidence_url: null });
  });
});
