import { describe, expect, it } from 'vitest';
import { pid, zenodoSearchUrl } from '../../../src/fair/rules/pid.ts';
import { fixtureClient, fixtureHttp, offlineContext, overridingHttp, repo } from './fixture-client.ts';

const gh = fixtureClient(); // the rule needs no GitHub calls
const sklearn = repo('scikit-learn', 'scikit-learn');

describe('persistent identifier (Zenodo DOI) rule', () => {
  it('is met when Zenodo has a GitHub-release record for the repo, linking the concept DOI', async () => {
    const result = await pid.check(sklearn, gh, offlineContext({ http: fixtureHttp('zenodo-scikit-learn') }));
    expect(result).toMatchObject({ indicator: 'pid', state: 'met', evidence_url: 'https://doi.org/10.5281/zenodo.591564' });
    expect(result.detail).toContain('10.5281/zenodo.591564');
  });

  it('is unmet when Zenodo has no release record for the repo, linking the search', async () => {
    const result = await pid.check(repo('octocat', 'Hello-World'), gh, offlineContext({ http: fixtureHttp('zenodo-octocat') }));
    expect(result.state).toBe('unmet');
    expect(result.evidence_url).toMatch(/^https:\/\/zenodo\.org\/search\?q=/);
  });

  it('does not count a Zenodo record of a different repo that shares a name prefix', async () => {
    const http = overridingHttp(fixtureHttp('zenodo-scikit-learn'), {
      [`GET ${zenodoSearchUrl(sklearn)}`]: {
        status: 200,
        data: {
          hits: {
            hits: [
              {
                conceptdoi: '10.5281/zenodo.1',
                metadata: { related_identifiers: [{ identifier: 'https://github.com/scikit-learn/scikit-learn-extra/tree/v1.0.0' }] },
              },
            ],
          },
        },
      },
    });
    expect((await pid.check(sklearn, gh, offlineContext({ http }))).state).toBe('unmet');
  });

  it('is unknown, not unmet, when Zenodo errors', async () => {
    const http = overridingHttp(fixtureHttp(), { [`GET ${zenodoSearchUrl(sklearn)}`]: { status: 503, data: null } });
    const result = await pid.check(sklearn, gh, offlineContext({ http }));
    expect(result).toMatchObject({ state: 'unknown', evidence_url: null, detail: expect.stringContaining('upstream_error') });
  });
});
