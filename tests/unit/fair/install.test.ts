import { describe, expect, it } from 'vitest';
import { install } from '../../../src/fair/rules/install.ts';
import type { GitHubResponse } from '../../../src/fair/types.ts';
import { fixtureClient, offlineContext, overriding, repo } from './fixture-client.ts';

const README_URL = 'https://github.com/octocat/Hello-World/blob/master/README';
const readmeSaying = (text: string): Record<string, GitHubResponse> => ({
  'GET /repos/octocat/Hello-World/readme': {
    status: 200,
    data: { html_url: README_URL, encoding: 'base64', content: Buffer.from(text).toString('base64') },
  },
});

describe('install instructions rule', () => {
  it('is met when the README has an install heading or command, linking the README', async () => {
    const result = await install.check(repo('psf', 'requests'), fixtureClient('readme-psf-requests'), offlineContext());
    expect(result).toMatchObject({
      indicator: 'install',
      state: 'met',
      evidence_url: 'https://github.com/psf/requests/blob/main/README.md',
    });
  });

  it.each([
    ['an "Installation" heading', 'Intro\n\n## Installation\n\nDownload it.'],
    ['an underlined "Install" heading', 'Intro\n\nInstall\n-------\n\nDownload it.'],
    ['an npm install command', 'Run `npm install thing` first.'],
    ['a conda mention', 'Create the env with conda.'],
    ['a docker mention', 'Run it with Docker.'],
  ])('is met for %s', async (_, text) => {
    const gh = overriding(fixtureClient('readme-octocat'), readmeSaying(text));
    expect((await install.check(repo('octocat', 'Hello-World'), gh, offlineContext())).state).toBe('met');
  });

  it('is unmet when the README says nothing about installing, linking the README', async () => {
    const result = await install.check(repo('octocat', 'Hello-World'), fixtureClient('readme-octocat'), offlineContext());
    expect(result).toMatchObject({ state: 'unmet', evidence_url: README_URL });
  });

  it('does not count "install" mentioned only in passing prose', async () => {
    const gh = overriding(fixtureClient('readme-octocat'), readmeSaying('We reinstalled the server last year.\n## Usage\n'));
    expect((await install.check(repo('octocat', 'Hello-World'), gh, offlineContext())).state).toBe('unmet');
  });

  it('is unknown when the listed repo cannot be found', async () => {
    const result = await install.check(
      repo('octocat', 'this-repo-does-not-exist-xyz'),
      fixtureClient('readme-repo-not-found'),
      offlineContext(),
    );
    expect(result).toMatchObject({ state: 'unknown', evidence_url: null });
  });
});
