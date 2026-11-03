import { DEFAULT_TIMEOUT_MS } from './check.ts';
import type { HttpClient } from './types.ts';

export interface HttpClientOptions {
  /** Injected for tests; defaults to the global fetch. */
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
}

/**
 * GET-only JSON client for public registries and archives (Zenodo, PyPI, CRAN,
 * npm, Software Heritage). Sends no credentials. Each call aborts after
 * `timeoutMs` (throws TimeoutError).
 */
export function createHttpClient(opts: HttpClientOptions = {}): HttpClient {
  const doFetch = opts.fetch ?? globalThis.fetch;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  return {
    async get(url) {
      const res = await doFetch(url, {
        method: 'GET',
        headers: { accept: 'application/json', 'user-agent': 'capability-registry-fair-check' },
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
