import { readFileSync } from 'node:fs';
import type { GitHubClient, GitHubResponse, HttpClient, HttpResponse, RepoRef, RuleContext } from '../../../src/fair/types.ts';

function loadCassettes(dir: 'github' | 'http', names: string[]): Map<string, GitHubResponse> {
  const recorded = new Map<string, GitHubResponse>();
  for (const name of names) {
    const url = new URL(`../../fixtures/${dir}/${name}.json`, import.meta.url);
    const cassette = JSON.parse(readFileSync(url, 'utf8')) as Record<string, unknown>;
    for (const [key, value] of Object.entries(cassette)) {
      if (!key.startsWith('_')) recorded.set(key, value as GitHubResponse);
    }
  }
  return recorded;
}

/**
 * Replays recorded GitHub API responses from tests/fixtures/github/<name>.json.
 * Keys are "<METHOD> <path>"; a request with no recording throws, so tests never
 * silently depend on an unrecorded call. Keys starting with "_" are notes.
 */
export function fixtureClient(...names: string[]): GitHubClient {
  const recorded = loadCassettes('github', names);
  return {
    async request(method, path) {
      const hit = recorded.get(`${method} ${path}`);
      if (!hit) throw new Error(`No recorded response for ${method} ${path}`);
      return hit;
    },
  };
}

/**
 * Replays recorded non-GitHub responses (Zenodo, PyPI, CRAN, npm, Software
 * Heritage) from tests/fixtures/http/<name>.json, keyed "GET <absolute url>".
 * Unrecorded URLs throw, so no test ever reaches the network.
 */
export function fixtureHttp(...names: string[]): HttpClient {
  const recorded = loadCassettes('http', names);
  return {
    async get(url) {
      const hit = recorded.get(`GET ${url}`);
      if (!hit) throw new Error(`No recorded response for GET ${url}`);
      return hit;
    },
  };
}

/** An HttpClient that refuses every call; for rules that only need GitHub. */
export const noHttp: HttpClient = {
  async get(url) {
    throw new Error(`Unexpected non-GitHub call: GET ${url}`);
  },
};

export function offlineContext(overrides: Partial<RuleContext> = {}): RuleContext {
  return { http: noHttp, now: new Date('2026-11-03T02:00:00Z'), ...overrides };
}

/** Wraps a recorded client, replacing specific "<METHOD> <path>" responses (e.g. to corrupt a file). */
export function overriding(gh: GitHubClient, responses: Record<string, GitHubResponse>): GitHubClient {
  return {
    request: async (method, path, body) => responses[`${method} ${path}`] ?? gh.request(method, path, body),
  };
}

/** Same as `overriding`, for non-GitHub responses keyed "GET <url>". */
export function overridingHttp(http: HttpClient, responses: Record<string, HttpResponse>): HttpClient {
  return { get: async (url) => responses[`GET ${url}`] ?? http.get(url) };
}

export const repo = (owner: string, name: string): RepoRef => ({ owner, name, url: `https://github.com/${owner}/${name}` });
