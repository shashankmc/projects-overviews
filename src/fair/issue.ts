import { isOk } from './fetch.ts';
import type { GitHubClient, GitHubResponse } from './types.ts';

export interface IssueTarget {
  /** `owner/name` of the repo holding the rolling issue. */
  repo: string;
  /** The label that identifies the rolling issue; the only lookup key. */
  label: string;
  title: string;
  body: string;
}

export interface UpsertOutcome {
  action: 'created' | 'updated';
  number: number;
}

function ok(res: GitHubResponse, what: string): unknown {
  if (!isOk(res)) throw new Error(`GitHub ${what} failed with HTTP ${res.status}`);
  return res.data;
}

/**
 * Finds the oldest open issue carrying `label` and overwrites it, or creates one.
 * Idempotent: running it any number of times leaves one open labelled issue.
 */
export async function upsertIssue(gh: GitHubClient, target: IssueTarget): Promise<UpsertOutcome> {
  const base = `/repos/${target.repo}/issues`;
  const query = new URLSearchParams({ state: 'open', labels: target.label, sort: 'created', direction: 'asc', per_page: '100' });
  const open = ok(await gh.request('GET', `${base}?${query}`), 'issue lookup') as { number: number; pull_request?: unknown }[];
  const existing = open.find((i) => !i.pull_request);
  if (existing) {
    ok(await gh.request('PATCH', `${base}/${existing.number}`, { title: target.title, body: target.body }), 'issue update');
    return { action: 'updated', number: existing.number };
  }
  const created = ok(
    await gh.request('POST', base, { title: target.title, body: target.body, labels: [target.label] }),
    'issue create',
  ) as { number: number };
  return { action: 'created', number: created.number };
}
