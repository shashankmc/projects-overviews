import { describe, expect, it } from 'vitest';
import { registry, registryLookups } from '../../../src/fair/rules/registry.ts';
import type { HttpClient } from '../../../src/fair/types.ts';
import { fixtureClient, fixtureHttp, offlineContext, overridingHttp, repo } from './fixture-client.ts';

const gh = fixtureClient(); // the rule needs no GitHub calls
const check = (owner: string, name: string, http: HttpClient) => registry.check(repo(owner, name), gh, offlineContext({ http }));
const missing = { status: 404, data: null };

describe('registry presence rule', () => {
  it('is met by a PyPI package whose project URLs point back to the repo, linking the package', async () => {
    const result = await check('psf', 'requests', fixtureHttp('registry-psf-requests'));
    expect(result).toMatchObject({ indicator: 'registry', state: 'met', evidence_url: 'https://pypi.org/project/requests/' });
  });

  it('is met by a CRAN package whose URL field points back, ignoring a same-named npm package that does not', async () => {
    const result = await check('tidyverse', 'ggplot2', fixtureHttp('registry-tidyverse-ggplot2'));
    expect(result).toMatchObject({ state: 'met', evidence_url: 'https://cran.r-project.org/package=ggplot2' });
    expect(result.detail).not.toContain('npm');
  });

  it('is met by an npm package whose repository points back', async () => {
    const result = await check('expressjs', 'express', fixtureHttp('registry-expressjs-express'));
    expect(result).toMatchObject({ state: 'met', evidence_url: 'https://www.npmjs.com/package/express' });
  });

  it('is met by a Software Heritage origin when no package points back', async () => {
    // PyPI "hello-world" and npm "hello-world" exist but belong to other projects.
    const result = await check('octocat', 'Hello-World', fixtureHttp('registry-octocat'));
    expect(result).toMatchObject({
      state: 'met',
      evidence_url: 'https://archive.softwareheritage.org/browse/origin/?origin_url=https://github.com/octocat/Hello-World',
    });
    expect(result.detail).toMatch(/Software Heritage/);
    expect(result.detail).not.toMatch(/PyPI|npm/);
  });

  it('does not count same-named packages that do not point back', async () => {
    const lookups = registryLookups(repo('psf', 'requests'));
    const http = overridingHttp(fixtureHttp('registry-psf-requests'), { [`GET ${lookups.pypi}`]: missing, [`GET ${lookups.swh}`]: missing });
    // npm "requests" exists but points at unshiftio/requests.
    const result = await check('psf', 'requests', http);
    expect(result.state).toBe('unmet');
  });

  it('is unmet when no registry or archive knows the repo', async () => {
    const result = await check('octocat', 'this-repo-does-not-exist-xyz', fixtureHttp('registry-repo-not-found'));
    expect(result).toMatchObject({ state: 'unmet', evidence_url: null });
  });

  it('is unknown, not unmet, when a lookup errors and nothing else matched', async () => {
    const { swh } = registryLookups(repo('octocat', 'this-repo-does-not-exist-xyz'));
    const http = overridingHttp(fixtureHttp('registry-repo-not-found'), { [`GET ${swh}`]: { status: 503, data: null } });
    const result = await check('octocat', 'this-repo-does-not-exist-xyz', http);
    expect(result).toMatchObject({ state: 'unknown', evidence_url: null, detail: expect.stringContaining('upstream_error') });
  });

  it('is still met when one lookup fails (network) but another points back', async () => {
    const { npm } = registryLookups(repo('psf', 'requests'));
    const base = fixtureHttp('registry-psf-requests');
    const http: HttpClient = {
      get: async (url) => {
        if (url === npm) throw new Error('ECONNRESET');
        return base.get(url);
      },
    };
    expect((await check('psf', 'requests', http)).state).toBe('met');
  });
});
