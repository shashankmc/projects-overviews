import { describe, expect, it } from 'vitest';
import { runFairCheck } from '../../../src/fair/check.ts';
import { NetworkError } from '../../../src/fair/errors.ts';
import { licence } from '../../../src/fair/rules/licence.ts';
import type { GitHubClient, HttpClient, Rule, RuleContext } from '../../../src/fair/types.ts';
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

  it('turns a rule whose network call fails into unknown (network_error) and keeps going', async () => {
    const broken: Rule = {
      indicator: 'broken',
      title: 'Broken',
      check: async () => {
        throw new NetworkError('socket hang up');
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
    expect(report.projects[0]!.repos[0]!.results[0]!.detail).toBe('Could not check (network_error)');
    expect(report.internal_errors).toEqual([]);
  });

  it('classifies a fetch that aborted on its own timeout as timeout', async () => {
    const aborted: Rule = {
      indicator: 'aborted',
      title: 'Aborted',
      check: async () => {
        throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
      },
    };
    const report = await runFairCheck({ projects: [{ id: 'p1', name: 'CLE', repos: ['cli/cli'] }] }, fixtureClient(), { rules: [aborted], now });
    expect(report.projects[0]!.repos[0]!.results[0]!.detail).toBe('Could not check (timeout)');
    expect(report.internal_errors).toEqual([]);
  });

  it('records any other thrown error (a bug, an unexpected payload) as internal_error and lists it, without leaking its text', async () => {
    const buggy: Rule = {
      indicator: 'buggy',
      title: 'Buggy',
      check: async () => {
        throw new TypeError("Cannot read properties of undefined (reading 'hits')");
      },
    };
    const report = await runFairCheck(
      { projects: [{ id: 'p1', name: 'CLE', repos: ['cli/cli'] }] },
      fixtureClient('licence-met'),
      { rules: [buggy, licence], now },
    );
    const results = report.projects[0]!.repos[0]!.results;
    expect(results[0]).toEqual({ indicator: 'buggy', state: 'unknown', evidence_url: null, detail: 'Could not check (internal_error)' });
    expect(results[1]!.state).toBe('met');
    expect(report.internal_errors).toEqual([{ listed: 'cli/cli', indicator: 'buggy' }]);
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

  it('gives every rule the run clock and the injected non-GitHub client', async () => {
    const http: HttpClient = { get: async () => ({ status: 200, data: { ok: true } }) };
    let seen: RuleContext | undefined;
    const spy: Rule = {
      indicator: 'spy',
      title: 'Spy',
      check: async (_repo, _gh, ctx) => {
        seen = ctx;
        return { indicator: 'spy', state: 'met', evidence_url: null, detail: '' };
      },
    };
    await runFairCheck({ projects: [{ id: 'p1', name: 'CLE', repos: ['cli/cli'] }] }, fixtureClient(), { rules: [spy], now, http });
    expect(seen!.now).toEqual(now);
    expect(seen!.http).toBe(http);
  });

  it('never reaches the network for non-GitHub lookups unless a client is injected: they resolve to unknown', async () => {
    const usesHttp: Rule = {
      indicator: 'zenodo',
      title: 'Zenodo',
      check: async (_repo, _gh, { http }) => {
        await http.get('https://zenodo.org/api/records');
        return { indicator: 'zenodo', state: 'met', evidence_url: null, detail: '' };
      },
    };
    const report = await runFairCheck({ projects: [{ id: 'p1', name: 'CLE', repos: ['cli/cli'] }] }, fixtureClient(), { rules: [usesHttp], now });
    expect(report.projects[0]!.repos[0]!.results[0]!.state).toBe('unknown');
  });
});
