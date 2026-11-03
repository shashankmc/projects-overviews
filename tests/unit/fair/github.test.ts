import { describe, expect, it } from 'vitest';
import { createGitHubClient } from '../../../src/fair/github.ts';

function recordingFetch(status: number, payload: unknown) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetch = async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(payload === undefined ? null : JSON.stringify(payload), { status });
  };
  return { fetch: fetch as typeof globalThis.fetch, calls };
}

describe('createGitHubClient', () => {
  it('calls the REST API with the token and a JSON body, returning status and parsed data', async () => {
    const f = recordingFetch(201, { number: 7 });
    const gh = createGitHubClient({ token: 't0k', fetch: f.fetch });
    const res = await gh.request('POST', '/repos/o/r/issues', { title: 'x' });
    expect(res).toEqual({ status: 201, data: { number: 7 } });
    expect(f.calls[0]!.url).toBe('https://api.github.com/repos/o/r/issues');
    const headers = new Headers(f.calls[0]!.init.headers);
    expect(headers.get('authorization')).toBe('Bearer t0k');
    expect(f.calls[0]!.init.body).toBe('{"title":"x"}');
    expect(f.calls[0]!.init.signal).toBeInstanceOf(AbortSignal);
  });

  it('returns non-2xx responses instead of throwing', async () => {
    const gh = createGitHubClient({ token: 't', fetch: recordingFetch(404, { message: 'Not Found' }).fetch });
    expect(await gh.request('GET', '/repos/o/r/license')).toEqual({ status: 404, data: { message: 'Not Found' } });
  });
});
