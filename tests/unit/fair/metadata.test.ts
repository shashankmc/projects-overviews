import { describe, expect, it } from 'vitest';
import { metadata } from '../../../src/fair/rules/metadata.ts';
import { fixtureClient, offlineContext, overriding, repo } from './fixture-client.ts';

const CODEMETA_URL = 'https://github.com/ropensci/codemetar/blob/main/codemeta.json';

describe('metadata (codemeta.json) rule', () => {
  it('is met when codemeta.json parses, linking the file', async () => {
    const result = await metadata.check(repo('codemeta', 'codemetar'), fixtureClient('metadata-met'), offlineContext());
    expect(result).toMatchObject({ indicator: 'metadata', state: 'met', evidence_url: CODEMETA_URL });
  });

  it('is unmet when the repo has no codemeta.json, linking the repo', async () => {
    const result = await metadata.check(repo('octocat', 'Hello-World'), fixtureClient('metadata-unmet'), offlineContext());
    expect(result).toMatchObject({ state: 'unmet', evidence_url: 'https://github.com/octocat/Hello-World' });
  });

  it('is unmet when codemeta.json is not valid JSON, naming the line', async () => {
    const gh = overriding(fixtureClient('metadata-met'), {
      'GET /repos/codemeta/codemetar/contents/codemeta.json': {
        status: 200,
        data: {
          html_url: CODEMETA_URL,
          encoding: 'base64',
          content: Buffer.from('{\n  "@context": "https://doi.org/10.5063/schema/codemeta-2.0",\n  "name": "x",\n}\n').toString('base64'),
        },
      },
    });
    const result = await metadata.check(repo('codemeta', 'codemetar'), gh, offlineContext());
    expect(result).toMatchObject({ state: 'unmet', evidence_url: CODEMETA_URL });
    expect(result.detail).toContain('invalid (line 4)');
  });

  it('is unknown when the listed repo cannot be found', async () => {
    const result = await metadata.check(
      repo('octocat', 'this-repo-does-not-exist-xyz'),
      fixtureClient('metadata-repo-not-found'),
      offlineContext(),
    );
    expect(result).toMatchObject({ state: 'unknown', evidence_url: null });
    expect(result.detail).toContain('not_found');
  });
});
