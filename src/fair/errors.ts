import type { GitHubResponse, IndicatorResult } from './types.ts';

/**
 * Error classes from the spec; raw upstream error text is never reported.
 * `internal_error` is any thrown error that is neither a timeout nor a network
 * failure (a bug, an unexpected payload): it is reported as unknown and fails
 * the run loudly (spec: "No catch-alls ... Unknown error classes fail the run loudly").
 */
export type ErrorClass =
  | 'not_found'
  | 'forbidden'
  | 'rate_limited'
  | 'auth_expired'
  | 'upstream_error'
  | 'timeout'
  | 'network_error'
  | 'internal_error';

/**
 * Thrown by the HTTP clients when a request got no HTTP answer at all (DNS,
 * connection reset, TLS). Timeouts are not wrapped: they stay `TimeoutError`.
 */
export class NetworkError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'NetworkError';
  }
}

const errorName = (err: unknown): unknown => (typeof err === 'object' && err !== null ? (err as { name?: unknown }).name : undefined);

/** Class of a thrown error: timeouts and network failures are expected; anything else is internal. */
export function thrownErrorClass(err: unknown): ErrorClass {
  const name = errorName(err);
  if (name === 'TimeoutError') return 'timeout';
  if (name === 'NetworkError') return 'network_error';
  return 'internal_error';
}

export function errorClassOf(res: GitHubResponse): ErrorClass {
  if (res.status === 404) return 'not_found';
  if (res.status === 401) return 'auth_expired';
  if (res.status === 429) return 'rate_limited';
  if (res.status === 403) {
    const message = (res.data as { message?: unknown } | null)?.message;
    return typeof message === 'string' && /rate limit/i.test(message) ? 'rate_limited' : 'forbidden';
  }
  return 'upstream_error';
}

export function unknownResult(indicator: string, cls: ErrorClass): IndicatorResult {
  return { indicator, state: 'unknown', evidence_url: null, detail: `Could not check (${cls})` };
}
