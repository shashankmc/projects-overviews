import { DEFAULT_TIMEOUT_MS, fetchJson } from './fetch.ts';
import type { GitHubClient } from './types.ts';

export interface ClientOptions {
  token: string;
  /** Injected for tests; defaults to the global fetch. */
  fetch?: typeof globalThis.fetch;
  apiUrl?: string;
  timeoutMs?: number;
}

/**
 * REST client over fetch. Each call aborts after `timeoutMs` (throws
 * TimeoutError); other fetch failures throw NetworkError.
 */
export function createGitHubClient(opts: ClientOptions): GitHubClient {
  const doFetch = opts.fetch ?? globalThis.fetch;
  const apiUrl = (opts.apiUrl ?? 'https://api.github.com').replace(/\/$/, '');
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  return {
    request: (method, path, body) =>
      fetchJson(
        doFetch,
        apiUrl + path,
        {
          method,
          headers: {
            accept: 'application/vnd.github+json',
            authorization: `Bearer ${opts.token}`,
            'x-github-api-version': '2022-11-28',
            'user-agent': 'capability-registry-fair-check',
            ...(body === undefined ? {} : { 'content-type': 'application/json' }),
          },
          body: body === undefined ? undefined : JSON.stringify(body),
        },
        timeoutMs,
      ),
  };
}
