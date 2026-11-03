import { describe, expect, it } from 'vitest';
import { readmeDocs } from '../../../src/fair/rules/readme-docs.ts';
import { fixtureClient, offlineContext, overriding, repo } from './fixture-client.ts';

describe('README and docs rule', () => {
  it('is met when the README has at least 500 characters, linking it and noting the docs/ folder', async () => {
    const result = await readmeDocs.check(repo('psf', 'requests'), fixtureClient('readme-psf-requests'), offlineContext());
    expect(result).toMatchObject({
      indicator: 'readme_docs',
      state: 'met',
      evidence_url: 'https://github.com/psf/requests/blob/main/README.md',
    });
    expect(result.detail).toContain('docs/ folder');
  });

  it('is still met without a docs/ folder, which is only supporting evidence', async () => {
    const gh = overriding(fixtureClient('readme-psf-requests'), {
      'GET /repos/psf/requests/contents/docs': { status: 404, data: { message: 'Not Found' } },
    });
    const result = await readmeDocs.check(repo('psf', 'requests'), gh, offlineContext());
    expect(result.state).toBe('met');
    expect(result.detail).not.toContain('docs/ folder');
  });

  it('is unmet when the README is shorter than 500 characters, linking it', async () => {
    const result = await readmeDocs.check(repo('octocat', 'Hello-World'), fixtureClient('readme-octocat'), offlineContext());
    expect(result).toMatchObject({ state: 'unmet', evidence_url: 'https://github.com/octocat/Hello-World/blob/master/README' });
    expect(result.detail).toMatch(/\b13 characters/);
  });

  it('is unknown when the listed repo cannot be found', async () => {
    const result = await readmeDocs.check(
      repo('octocat', 'this-repo-does-not-exist-xyz'),
      fixtureClient('readme-repo-not-found'),
      offlineContext(),
    );
    expect(result).toMatchObject({ state: 'unknown', evidence_url: null });
    expect(result.detail).toContain('not_found');
  });

  it('records a docs URL from the README but ignores documentation badges', async () => {
    const readme = (text: string) =>
      overriding(fixtureClient('readme-octocat'), {
        'GET /repos/octocat/Hello-World/readme': {
          status: 200,
          data: { html_url: 'https://github.com/octocat/Hello-World/blob/master/README', encoding: 'base64', content: Buffer.from(text).toString('base64') },
        },
      });
    const badge = '[![Docs](https://readthedocs.org/projects/hello/badge/?version=latest)](https://hello.readthedocs.io)';
    const result = await readmeDocs.check(repo('octocat', 'Hello-World'), readme(badge), offlineContext());
    expect(result.detail).toContain('docs URL https://hello.readthedocs.io');
    expect(result.detail).not.toContain('badge');
  });
});
