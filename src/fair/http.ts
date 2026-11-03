import { DEFAULT_TIMEOUT_MS, fetchJson } from './fetch.ts';
import type { HttpClient } from './types.ts';

export interface HttpClientOptions {
  /** Injected for tests; defaults to the global fetch. */
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
}

const HEADERS = { accept: 'application/json', 'user-agent': 'capability-registry-fair-check' };

/**
 * GET-only JSON client for public registries and archives (Zenodo, PyPI, CRAN,
 * npm, Software Heritage). Sends no credentials. Each call aborts after
 * `timeoutMs` (throws TimeoutError); other fetch failures throw NetworkError.
 */
export function createHttpClient(opts: HttpClientOptions = {}): HttpClient {
  const doFetch = opts.fetch ?? globalThis.fetch;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  return {
    get: (url) => fetchJson(doFetch, url, { method: 'GET', headers: HEADERS }, timeoutMs),
  };
}
