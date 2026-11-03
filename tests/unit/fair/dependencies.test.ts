import { describe, expect, it } from 'vitest';
import { dependencies } from '../../../src/fair/rules/dependencies.ts';
import { fixtureClient, offlineContext, overriding, repo } from './fixture-client.ts';

const rootWith = (...names: string[]) =>
  overriding(fixtureClient('contents-octocat'), {
    'GET /repos/octocat/Hello-World/contents': {
      status: 200,
      data: names.map((name) => ({ name, path: name, type: 'file', html_url: `https://github.com/octocat/Hello-World/blob/master/${name}` })),
    },
  });

describe('declared dependencies rule', () => {
  it('is met when a manifest exists, linking it', async () => {
    const result = await dependencies.check(repo('psf', 'requests'), fixtureClient('contents-psf-requests'), offlineContext());
    expect(result).toMatchObject({
      indicator: 'dependencies',
      state: 'met',
      evidence_url: 'https://github.com/psf/requests/blob/main/pyproject.toml',
    });
  });

  it.each(['requirements.txt', 'requirements-dev.txt', 'package.json', 'DESCRIPTION', 'environment.yml'])(
    'is met by %s',
    async (name) => {
      const result = await dependencies.check(repo('octocat', 'Hello-World'), rootWith('README', name), offlineContext());
      expect(result).toMatchObject({ state: 'met', evidence_url: `https://github.com/octocat/Hello-World/blob/master/${name}` });
    },
  );

  it('is unmet when no manifest exists, linking the repo', async () => {
    const result = await dependencies.check(repo('octocat', 'Hello-World'), fixtureClient('contents-octocat'), offlineContext());
    expect(result).toMatchObject({ state: 'unmet', evidence_url: 'https://github.com/octocat/Hello-World' });
  });

  it('is unknown when the listed repo cannot be found', async () => {
    const result = await dependencies.check(
      repo('octocat', 'this-repo-does-not-exist-xyz'),
      fixtureClient('contents-repo-not-found'),
      offlineContext(),
    );
    expect(result).toMatchObject({ state: 'unknown', evidence_url: null });
  });
});
