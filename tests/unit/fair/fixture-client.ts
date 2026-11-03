import { readFileSync } from 'node:fs';
import type { GitHubClient, GitHubResponse } from '../../../src/fair/types.ts';

/**
 * Replays recorded GitHub API responses from tests/fixtures/github/<name>.json.
 * Keys are "<METHOD> <path>"; a request with no recording throws, so tests never
 * silently depend on an unrecorded call. Keys starting with "_" are notes.
 */
export function fixtureClient(...names: string[]): GitHubClient {
  const recorded = new Map<string, GitHubResponse>();
  for (const name of names) {
    const url = new URL(`../../fixtures/github/${name}.json`, import.meta.url);
    const cassette = JSON.parse(readFileSync(url, 'utf8')) as Record<string, unknown>;
    for (const [key, value] of Object.entries(cassette)) {
      if (!key.startsWith('_')) recorded.set(key, value as GitHubResponse);
    }
  }
  return {
    async request(method, path) {
      const hit = recorded.get(`${method} ${path}`);
      if (!hit) throw new Error(`No recorded response for ${method} ${path}`);
      return hit;
    },
  };
}
