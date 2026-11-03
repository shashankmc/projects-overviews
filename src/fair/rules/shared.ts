// Helpers shared by the rule modules. Rules stay independent: each makes its own calls.
import { errorClassOf, unknownResult } from '../errors.ts';
import type { GitHubClient, GitHubResponse, IndicatorResult, IndicatorState, RepoRef } from '../types.ts';

export type Result = (state: IndicatorState, evidence_url: string | null, detail: string) => IndicatorResult;

export const resultFor =
  (indicator: string): Result =>
  (state, evidence_url, detail) => ({ indicator, state, evidence_url, detail });

/** REST path of the repo, or of something under it (`suffix` starts with "/"). */
export const repoPath = (repo: RepoRef, suffix = ''): string => `/repos/${repo.owner}/${repo.name}${suffix}`;

/** A file from the contents/readme API. */
export interface RepoFile {
  html_url: string;
  text: string;
}

export function decodeFile(data: unknown): RepoFile {
  const { html_url, content, encoding } = data as { html_url: string; content?: string; encoding?: string };
  const text = encoding === 'base64' && content ? Buffer.from(content, 'base64').toString('utf8') : (content ?? '');
  return { html_url, text };
}

/** One entry of a contents-API directory listing. */
export interface DirEntry {
  name: string;
  path: string;
  type: 'file' | 'dir' | 'symlink' | 'submodule';
  html_url: string;
}

/**
 * Resolves a non-2xx response for something the rule looked for. A 404 means
 * "absent" (unmet, linking the repo) only if the repo itself is visible;
 * anything else is unknown with its error class.
 */
export async function absentOrUnknown(
  indicator: string,
  res: GitHubResponse,
  repo: RepoRef,
  gh: GitHubClient,
  absentDetail: string,
): Promise<IndicatorResult> {
  if (res.status !== 404) return unknownResult(indicator, errorClassOf(res));
  const repoRes = await gh.request('GET', repoPath(repo));
  if (repoRes.status === 200) return resultFor(indicator)('unmet', repo.url, absentDetail);
  return unknownResult(indicator, errorClassOf(repoRes));
}
