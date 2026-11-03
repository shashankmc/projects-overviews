import { describe, expect, it } from 'vitest';
import { NetworkError } from '../../../src/fair/errors.ts';
import type { GitHubClient, GitHubResponse } from '../../../src/fair/types.ts';
import { buildHeartbeat } from '../../../src/heartbeat/status.ts';

const NOW = new Date('2026-11-03T04:05:06.000Z');
const RUNS_PATH = '/repos/o/r/actions/workflows/fair.yml/runs?status=completed&per_page=1&exclude_pull_requests=true';

function clientReturning(res: GitHubResponse | Error): GitHubClient & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async request(method, path) {
      calls.push(`${method} ${path}`);
      if (res instanceof Error) throw res;
      return res;
    },
  };
}

describe('buildHeartbeat', () => {
  it('records the timestamp and the latest completed FAIR run', async () => {
    const gh = clientReturning({
      status: 200,
      data: {
        total_count: 40,
        workflow_runs: [
          {
            id: 123,
            conclusion: 'success',
            run_started_at: '2026-11-03T02:17:30Z',
            html_url: 'https://github.com/o/r/actions/runs/123',
          },
        ],
      },
    });
    expect(await buildHeartbeat({ gh, repo: 'o/r', now: NOW })).toEqual({
      generated_at: '2026-11-03T04:05:06.000Z',
      fair_last_run: {
        result: 'success',
        run_id: 123,
        started_at: '2026-11-03T02:17:30Z',
        url: 'https://github.com/o/r/actions/runs/123',
      },
    });
    expect(gh.calls).toEqual([`GET ${RUNS_PATH}`]);
  });

  it('says "none" when the FAIR workflow has never completed a run', async () => {
    const gh = clientReturning({ status: 200, data: { total_count: 0, workflow_runs: [] } });
    expect(await buildHeartbeat({ gh, repo: 'o/r', now: NOW })).toEqual({
      generated_at: '2026-11-03T04:05:06.000Z',
      fair_last_run: { result: 'none', run_id: null, started_at: null, url: null },
    });
  });

  it('records an API error as unknown with its error class, never as a FAIR failure', async () => {
    const gh = clientReturning({ status: 403, data: { message: 'API rate limit exceeded for installation' } });
    expect((await buildHeartbeat({ gh, repo: 'o/r', now: NOW })).fair_last_run).toEqual({
      result: 'unknown',
      error: 'rate_limited',
      run_id: null,
      started_at: null,
      url: null,
    });
  });

  it('still produces a heartbeat when the API is unreachable', async () => {
    const gh = clientReturning(new NetworkError('fetch failed', { cause: new Error('getaddrinfo ENOTFOUND api.github.com') }));
    expect(await buildHeartbeat({ gh, repo: 'o/r', now: NOW })).toEqual({
      generated_at: '2026-11-03T04:05:06.000Z',
      fair_last_run: { result: 'unknown', error: 'network_error', run_id: null, started_at: null, url: null },
    });
  });

  it('classifies a timed-out API call as timeout', async () => {
    const gh = clientReturning(new DOMException('The operation was aborted due to timeout', 'TimeoutError'));
    expect((await buildHeartbeat({ gh, repo: 'o/r', now: NOW })).fair_last_run.error).toBe('timeout');
  });

  it('still produces a heartbeat on an unexpected error, recording it as internal_error', async () => {
    const gh = clientReturning(new TypeError('x is not a function'));
    expect((await buildHeartbeat({ gh, repo: 'o/r', now: NOW })).fair_last_run.error).toBe('internal_error');
  });
});
