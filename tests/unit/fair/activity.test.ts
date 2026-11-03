import { describe, expect, it } from 'vitest';
import { activity } from '../../../src/fair/rules/activity.ts';
import { fixtureClient, offlineContext, overriding, repo } from './fixture-client.ts';

const at = (iso: string) => offlineContext({ now: new Date(iso) });

describe('recent activity rule', () => {
  it('is met when the default branch has a commit within 12 months, linking the commit', async () => {
    const result = await activity.check(repo('psf', 'requests'), fixtureClient('activity-psf-requests'), at('2026-11-03T02:00:00Z'));
    expect(result).toMatchObject({
      indicator: 'activity',
      state: 'met',
      evidence_url: 'https://github.com/psf/requests/commit/3c7baaa05ab4aa49cc819ce3a819d260de19c157',
    });
    expect(result.detail).toContain('2026-10-26');
  });

  it('is unmet when the latest commit is older than 12 months, still linking it', async () => {
    const result = await activity.check(repo('octocat', 'Hello-World'), fixtureClient('activity-octocat'), at('2026-11-03T02:00:00Z'));
    expect(result).toMatchObject({
      state: 'unmet',
      evidence_url: 'https://github.com/octocat/Hello-World/commit/7fd1a60b01f91b314f59955a4e4d4e80d8edf11d',
    });
    expect(result.detail).toContain('2012-03-06');
  });

  it('measures the 12 months from the run date', async () => {
    const gh = fixtureClient('activity-psf-requests');
    expect((await activity.check(repo('psf', 'requests'), gh, at('2027-10-25T00:00:00Z'))).state).toBe('met');
    expect((await activity.check(repo('psf', 'requests'), gh, at('2027-10-27T00:00:00Z'))).state).toBe('unmet');
  });

  it('is unmet for an empty repo with no commits', async () => {
    const gh = overriding(fixtureClient('activity-octocat'), {
      'GET /repos/octocat/Hello-World/commits?sha=master&per_page=1': { status: 409, data: { message: 'Git Repository is empty.' } },
    });
    const result = await activity.check(repo('octocat', 'Hello-World'), gh, at('2026-11-03T02:00:00Z'));
    expect(result).toMatchObject({ state: 'unmet', evidence_url: 'https://github.com/octocat/Hello-World' });
  });

  it('is unknown when the listed repo cannot be found', async () => {
    const result = await activity.check(
      repo('octocat', 'this-repo-does-not-exist-xyz'),
      fixtureClient('activity-repo-not-found'),
      at('2026-11-03T02:00:00Z'),
    );
    expect(result).toMatchObject({ state: 'unknown', evidence_url: null, detail: expect.stringContaining('not_found') });
  });
});
