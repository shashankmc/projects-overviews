import { DEFAULT_TIMEOUT_MS } from './check.ts';
import type { GitHubClient } from './types.ts';

export interface ClientOptions {
  token: string;
  /** Injected for tests; defaults to the global fetch. */
  fetch?: typeof globalThis.fetch;
  apiUrl?: string;
  timeoutMs?: number;
}

/** REST client over fetch. Each call aborts after `timeoutMs` (throws TimeoutError). */
export function createGitHubClient(opts: ClientOptions): GitHubClient {
  const doFetch = opts.fetch ?? globalThis.fetch;
  const apiUrl = (opts.apiUrl ?? 'https://api.github.com').replace(/\/$/, '');
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  return {
    async request(method, path, body) {
      const res = await doFetch(apiUrl + path, {
        method,
        headers: {
          accept: 'application/vnd.github+json',
          authorization: `Bearer ${opts.token}`,
          'x-github-api-version': '2022-11-28',
          'user-agent': 'capability-registry-fair-check',
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
      const text = await res.text();
      let data: unknown = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = null;
      }
      return { status: res.status, data };
    },
  };
}
