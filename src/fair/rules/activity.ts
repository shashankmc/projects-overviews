import { errorClassOf, unknownResult } from '../errors.ts';
import type { Rule } from '../types.ts';
import { repoPath, resultFor } from './shared.ts';

const result = resultFor('activity');

export const ACTIVITY_WINDOW_MONTHS = 12;

interface Commit {
  html_url: string;
  commit: { committer: { date: string } | null };
}

/** recent activity: a commit on the default branch within the last 12 months of the run date. */
export const activity: Rule = {
  indicator: 'activity',
  title: 'Recent activity',
  async check(repo, gh, { now }) {
    const repoRes = await gh.request('GET', repoPath(repo));
    if (repoRes.status !== 200) return unknownResult('activity', errorClassOf(repoRes));
    const branch = (repoRes.data as { default_branch: string }).default_branch;

    const res = await gh.request('GET', repoPath(repo, `/commits?sha=${encodeURIComponent(branch)}&per_page=1`));
    if (res.status === 409) return result('unmet', repo.url, 'Repository has no commits');
    if (res.status !== 200) return unknownResult('activity', errorClassOf(res));
    const [latest] = res.data as Commit[];
    const date = latest?.commit.committer?.date;
    if (!latest || !date) return result('unmet', repo.url, `No commits on ${branch}`);

    const cutoff = new Date(now);
    cutoff.setUTCMonth(cutoff.getUTCMonth() - ACTIVITY_WINDOW_MONTHS);
    const day = date.slice(0, 10);
    if (new Date(date) >= cutoff) return result('met', latest.html_url, `Last commit on ${branch}: ${day}`);
    return result('unmet', latest.html_url, `Last commit on ${branch}: ${day}, more than ${ACTIVITY_WINDOW_MONTHS} months ago`);
  },
};
