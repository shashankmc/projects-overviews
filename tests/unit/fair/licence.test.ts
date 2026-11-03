import { describe, expect, it } from 'vitest';
import { licence } from '../../../src/fair/rules/licence.ts';
import { fixtureClient, offlineContext, repo } from './fixture-client.ts';

describe('licence rule', () => {
  it('is met when GitHub detects an SPDX licence, with the LICENSE file as evidence', async () => {
    const result = await licence.check(repo('cli', 'cli'), fixtureClient('licence-met'), offlineContext());
    expect(result).toMatchObject({
      indicator: 'licence',
      state: 'met',
      evidence_url: 'https://github.com/cli/cli/blob/trunk/LICENSE',
    });
    expect(result.detail).toContain('MIT');
  });

  it('is unmet when the repo exists but has no licence file, with the repo as evidence', async () => {
    const result = await licence.check(repo('octocat', 'Hello-World'), fixtureClient('licence-unmet'), offlineContext());
    expect(result).toMatchObject({
      indicator: 'licence',
      state: 'unmet',
      evidence_url: 'https://github.com/octocat/Hello-World',
    });
  });

  it('is unmet when the LICENSE file is not SPDX-detectable, linking the file', async () => {
    const result = await licence.check(repo('cli', 'cli'), fixtureClient('licence-noassertion'), offlineContext());
    expect(result).toMatchObject({
      state: 'unmet',
      evidence_url: 'https://github.com/cli/cli/blob/trunk/LICENSE',
    });
    expect(result.detail).toMatch(/not .*SPDX/i);
  });

  it('is unknown, not unmet, when GitHub rate-limits the request', async () => {
    const result = await licence.check(repo('cli', 'cli'), fixtureClient('licence-rate-limited'), offlineContext());
    expect(result).toMatchObject({ state: 'unknown', evidence_url: null });
    expect(result.detail).toContain('rate_limited');
  });

  it('is unknown when the listed repo cannot be found', async () => {
    const result = await licence.check(
      repo('octocat', 'this-repo-does-not-exist-xyz'),
      fixtureClient('licence-repo-not-found'),
      offlineContext(),
    );
    expect(result).toMatchObject({ state: 'unknown', evidence_url: null });
    expect(result.detail).toContain('not_found');
  });
});
