import { describe, expect, it } from 'vitest';
import { releases } from '../../../src/fair/rules/releases.ts';
import { fixtureClient, offlineContext, overriding, repo } from './fixture-client.ts';

const TAGS = '/repos/octocat/Hello-World/tags?per_page=100';
const withTags = (...names: string[]) =>
  overriding(fixtureClient('tags-octocat'), { [`GET ${TAGS}`]: { status: 200, data: names.map((name) => ({ name })) } });

describe('versioned releases rule', () => {
  it('is met when a semver tag exists, linking the newest one', async () => {
    const result = await releases.check(repo('psf', 'requests'), fixtureClient('tags-psf-requests'), offlineContext());
    expect(result).toMatchObject({
      indicator: 'releases',
      state: 'met',
      evidence_url: 'https://github.com/psf/requests/releases/tag/v2.34.2',
    });
  });

  it.each(['1.0.0', 'v0.3.12', '2.0.0-rc.1', '1.2.3+build.5'])('accepts %s as semver', async (tag) => {
    expect((await releases.check(repo('octocat', 'Hello-World'), withTags(tag), offlineContext())).state).toBe('met');
  });

  it.each([['nightly', 'v1', '1.2', 'release-2020', '01.2.3']])('rejects non-semver tags (%s ...)', async (...tags) => {
    const result = await releases.check(repo('octocat', 'Hello-World'), withTags(...tags), offlineContext());
    expect(result).toMatchObject({ state: 'unmet', evidence_url: 'https://github.com/octocat/Hello-World/tags' });
  });

  it('is unmet when the repo has no tags, linking the tags page', async () => {
    const result = await releases.check(repo('octocat', 'Hello-World'), fixtureClient('tags-octocat'), offlineContext());
    expect(result).toMatchObject({ state: 'unmet', evidence_url: 'https://github.com/octocat/Hello-World/tags' });
  });

  it('is unknown when the listed repo cannot be found', async () => {
    const result = await releases.check(
      repo('octocat', 'this-repo-does-not-exist-xyz'),
      fixtureClient('tags-repo-not-found'),
      offlineContext(),
    );
    expect(result).toMatchObject({ state: 'unknown', evidence_url: null, detail: expect.stringContaining('not_found') });
  });
});
