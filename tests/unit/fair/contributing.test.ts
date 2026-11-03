import { describe, expect, it } from 'vitest';
import { contributing } from '../../../src/fair/rules/contributing.ts';
import { fixtureClient, offlineContext, repo } from './fixture-client.ts';

describe('contributing guide rule', () => {
  it('is met when GitHub finds a CONTRIBUTING file (root, docs/ or .github/), linking it', async () => {
    const result = await contributing.check(repo('psf', 'requests'), fixtureClient('community-psf-requests'), offlineContext());
    expect(result).toMatchObject({
      indicator: 'contributing',
      state: 'met',
      evidence_url: 'https://github.com/psf/requests/blob/main/.github/CONTRIBUTING.md',
    });
  });

  it('is unmet when there is no CONTRIBUTING file, linking the community profile', async () => {
    const result = await contributing.check(repo('octocat', 'Hello-World'), fixtureClient('community-octocat'), offlineContext());
    expect(result).toMatchObject({ state: 'unmet', evidence_url: 'https://github.com/octocat/Hello-World/community' });
  });

  it('is unknown when the listed repo cannot be found', async () => {
    const result = await contributing.check(
      repo('octocat', 'this-repo-does-not-exist-xyz'),
      fixtureClient('community-repo-not-found'),
      offlineContext(),
    );
    expect(result).toMatchObject({ state: 'unknown', evidence_url: null, detail: expect.stringContaining('not_found') });
  });
});
