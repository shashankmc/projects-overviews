import { describe, expect, it } from 'vitest';
import { citation } from '../../../src/fair/rules/citation.ts';
import type { GitHubResponse } from '../../../src/fair/types.ts';
import { fixtureClient, offlineContext, overriding, repo } from './fixture-client.ts';

const SKLEARN_CFF = '/repos/scikit-learn/scikit-learn/contents/CITATION.cff';

describe('citation rule', () => {
  it('is met when CITATION.cff parses, linking the file', async () => {
    const result = await citation.check(repo('scikit-learn', 'scikit-learn'), fixtureClient('citation-met'), offlineContext());
    expect(result).toMatchObject({
      indicator: 'citation',
      state: 'met',
      evidence_url: 'https://github.com/scikit-learn/scikit-learn/blob/main/CITATION.cff',
    });
  });

  it('is unmet when the repo has no CITATION.cff, linking the repo', async () => {
    const result = await citation.check(repo('octocat', 'Hello-World'), fixtureClient('citation-unmet'), offlineContext());
    expect(result).toMatchObject({ state: 'unmet', evidence_url: 'https://github.com/octocat/Hello-World' });
  });

  it('is unmet when CITATION.cff does not parse, naming the line and linking the file', async () => {
    const broken: GitHubResponse = {
      status: 200,
      data: {
        name: 'CITATION.cff',
        html_url: 'https://github.com/scikit-learn/scikit-learn/blob/main/CITATION.cff',
        encoding: 'base64',
        content: Buffer.from('cff-version: 1.2.0\ntitle: x\nauthors:\n  - name: [unclosed\n').toString('base64'),
      },
    };
    const gh = overriding(fixtureClient('citation-met'), { [`GET ${SKLEARN_CFF}`]: broken });
    const result = await citation.check(repo('scikit-learn', 'scikit-learn'), gh, offlineContext());
    expect(result).toMatchObject({
      state: 'unmet',
      evidence_url: 'https://github.com/scikit-learn/scikit-learn/blob/main/CITATION.cff',
    });
    expect(result.detail).toMatch(/invalid \(line \d+\)/);
  });

  it('is unknown when the listed repo cannot be found', async () => {
    const result = await citation.check(
      repo('octocat', 'this-repo-does-not-exist-xyz'),
      fixtureClient('citation-repo-not-found'),
      offlineContext(),
    );
    expect(result).toMatchObject({ state: 'unknown', evidence_url: null });
    expect(result.detail).toContain('not_found');
  });
});
