// Leaf module shared by the GitHub and non-GitHub clients (and src/heartbeat).
// Keep its imports to errors.ts/types.ts: heartbeat.yml runs without `npm ci`.
import { NetworkError, thrownErrorClass } from './errors.ts';
import type { HttpResponse } from './types.ts';

/** Spec: 10 s per external call. */
export const DEFAULT_TIMEOUT_MS = 10_000;

/** True for a 2xx response. */
export const isOk = (res: HttpResponse): boolean => res.status >= 200 && res.status < 300;

/**
 * One fetch, aborted after `timeoutMs`. Returns the status and the parsed JSON
 * body (null when empty or not JSON); non-2xx is returned, not thrown. A
 * timeout throws `TimeoutError`; any other failure to get an answer throws
 * `NetworkError` (cause kept, never reported).
 */
export async function fetchJson(
  doFetch: typeof globalThis.fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<HttpResponse> {
  let status: number;
  let text: string;
  try {
    const res = await doFetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    status = res.status;
    text = await res.text();
  } catch (err) {
    if (thrownErrorClass(err) === 'timeout') throw err;
    throw new NetworkError('fetch failed', { cause: err });
  }
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  return { status, data };
}
