import type { GitHubResponse, IndicatorResult } from './types.ts';

/** Error classes from the spec; raw upstream error text is never reported. */
export type ErrorClass = 'not_found' | 'forbidden' | 'rate_limited' | 'auth_expired' | 'upstream_error' | 'timeout' | 'network_error';

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
