import type { GitHubClient } from '../../../src/fair/types.ts';

export interface FakeIssue {
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  labels: { name: string }[];
  pull_request?: object;
}

/**
 * In-memory stand-in for the GitHub issues REST endpoints of one repo
 * (list with state/labels filters, create, update). Not a mock: it keeps state
 * so tests assert on the resulting issues, not on calls.
 */
export function fakeIssuesRepo(fullName: string, seed: FakeIssue[] = []) {
  const issues: FakeIssue[] = structuredClone(seed);
  const base = `/repos/${fullName}/issues`;
  const client: GitHubClient = {
    async request(method, path, body) {
      const url = new URL(path, 'https://api.github.test');
      const b = body as { title?: string; body?: string; labels?: string[] };
      if (method === 'GET' && url.pathname === base) {
        const state = url.searchParams.get('state') ?? 'open';
        const labels = url.searchParams.get('labels')?.split(',') ?? [];
        const asc = url.searchParams.get('direction') === 'asc';
        const hits = issues
          .filter((i) => state === 'all' || i.state === state)
          .filter((i) => labels.every((l) => i.labels.some((x) => x.name === l)))
          .sort((x, y) => (asc ? x.number - y.number : y.number - x.number));
        return { status: 200, data: structuredClone(hits) };
      }
      if (method === 'POST' && url.pathname === base) {
        const issue: FakeIssue = {
          number: Math.max(0, ...issues.map((i) => i.number)) + 1,
          title: b.title ?? '',
          body: b.body ?? '',
          state: 'open',
          labels: (b.labels ?? []).map((name) => ({ name })),
        };
        issues.push(issue);
        return { status: 201, data: structuredClone(issue) };
      }
      const m = new RegExp(`^${base}/(\\d+)$`).exec(url.pathname);
      if (method === 'PATCH' && m) {
        const issue = issues.find((i) => i.number === Number(m[1]));
        if (!issue) return { status: 404, data: { message: 'Not Found' } };
        if (b.title !== undefined) issue.title = b.title;
        if (b.body !== undefined) issue.body = b.body;
        return { status: 200, data: structuredClone(issue) };
      }
      throw new Error(`fakeIssuesRepo: unhandled ${method} ${path}`);
    },
  };
  return { client, issues };
}
