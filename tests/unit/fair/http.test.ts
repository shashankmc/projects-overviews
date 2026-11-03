import { describe, expect, it } from 'vitest';
import { createHttpClient } from '../../../src/fair/http.ts';

describe('createHttpClient (non-GitHub registries)', () => {
  it('GETs the absolute URL with a JSON accept header and no GitHub token, returning parsed JSON', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const http = createHttpClient({
      fetch: async (url, init) => {
        calls.push({ url: String(url), init: init! });
        return new Response('{"info":{"name":"requests"}}', { status: 200 });
      },
    });
    const res = await http.get('https://pypi.org/pypi/requests/json');
    expect(res).toEqual({ status: 200, data: { info: { name: 'requests' } } });
    expect(calls[0]!.url).toBe('https://pypi.org/pypi/requests/json');
    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(headers.accept).toBe('application/json');
    expect(headers['user-agent']).toBeTruthy();
    expect(headers.authorization).toBeUndefined();
  });

  it('returns non-2xx statuses instead of throwing, with null data for non-JSON bodies', async () => {
    const http = createHttpClient({ fetch: async () => new Response('<html>busy</html>', { status: 503 }) });
    expect(await http.get('https://zenodo.org/api/records')).toEqual({ status: 503, data: null });
  });

  it('aborts a call that exceeds the timeout', async () => {
    const http = createHttpClient({
      timeoutMs: 20,
      fetch: (_url, init) =>
        new Promise((_, reject) => init!.signal!.addEventListener('abort', () => reject(init!.signal!.reason))),
    });
    await expect(http.get('https://crandb.r-pkg.org/x')).rejects.toMatchObject({ name: 'TimeoutError' });
  });
});
