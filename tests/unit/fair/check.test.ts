import { describe, expect, it } from 'vitest';
import { runFairCheck } from '../../../src/fair/check.ts';
import { licence } from '../../../src/fair/rules/licence.ts';
import type { GitHubClient, Rule } from '../../../src/fair/types.ts';
import { fixtureClient } from './fixture-client.ts';

const now = new Date('2026-11-03T02:00:00Z');

describe('runFairCheck', () => {
  it('reports projects without repos as "no repos listed" and never calls GitHub for them', async () => {
    const gh: GitHubClient = {
      request: async () => {
        throw new Error('GitHub must not be called');
      },
    };
    const report = await runFairCheck({ projects: [{ id: 'p1', name: 'Am AI Right' }] }, gh, { rules: [licence], now });
    expect(report.projects).toEqual([{ id: 'p1', name: 'Am AI Right', repos: [] }]);
    expect(report.generated_at).toBe('2026-11-03T02:00:00.000Z');
  });

  it('runs every rule on every listed repo', async () => {
    const report = await runFairCheck(
      { projects: [{ id: 'p1', name: 'CLE', repos: ['https://github.com/cli/cli'] }] },
      fixtureClient('licence-met'),
      { rules: [licence], now },
    );
    const [repo] = report.projects[0]!.repos;
    expect(repo!.listed).toBe('https://github.com/cli/cli');
    expect(repo!.results.map((r) => [r.indicator, r.state])).toEqual([['licence', 'met']]);
  });

  it('reports a repo entry that is not a GitHub repo as invalid instead of failing the run', async () => {
    const report = await runFairCheck(
      { projects: [{ id: 'p1', name: 'CLE', repos: ['https://gitlab.com/a/b', 'https://github.com/cli/cli'] }] },
      fixtureClient('licence-met'),
      { rules: [licence], now },
    );
    const [bad, good] = report.projects[0]!.repos;
    expect(bad).toMatchObject({ listed: 'https://gitlab.com/a/b', invalid: true, results: [] });
    expect(good!.results[0]!.state).toBe('met');
  });

  it('turns a rule that throws into unknown and keeps going', async () => {
    const broken: Rule = {
      indicator: 'broken',
      title: 'Broken',
      check: async () => {
        throw new Error('socket hang up');
      },
    };
    const report = await runFairCheck(
      { projects: [{ id: 'p1', name: 'CLE', repos: ['cli/cli'] }] },
      fixtureClient('licence-met'),
      { rules: [broken, licence], now },
    );
    const states = report.projects[0]!.repos[0]!.results.map((r) => [r.indicator, r.state]);
    expect(states).toEqual([
      ['broken', 'unknown'],
      ['licence', 'met'],
    ]);
    expect(report.projects[0]!.repos[0]!.results[0]!.detail).not.toContain('socket hang up');
  });

  it('turns a rule that exceeds the timeout into unknown', async () => {
    const slow: Rule = { indicator: 'slow', title: 'Slow', check: () => new Promise(() => {}) };
    const report = await runFairCheck(
      { projects: [{ id: 'p1', name: 'CLE', repos: ['cli/cli'] }] },
      fixtureClient(),
      { rules: [slow], now, timeoutMs: 20 },
    );
    expect(report.projects[0]!.repos[0]!.results[0]).toMatchObject({ state: 'unknown', detail: expect.stringContaining('timeout') });
  });
});
