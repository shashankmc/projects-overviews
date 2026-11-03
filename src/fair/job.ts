import { runFairCheck, type FairReport, type RegistryInput } from './check.ts';
import { upsertIssue, type UpsertOutcome } from './issue.ts';
import { renderReport } from './report.ts';
import { rules as defaultRules } from './rules/index.ts';
import type { GitHubClient, Rule } from './types.ts';

export const REPORT_LABEL = 'fair-report';
export const REPORT_TITLE = 'FAIR evidence report (nightly)';

export interface JobOptions {
  registry: RegistryInput;
  gh: GitHubClient;
  /** `owner/name` of the repo that holds the rolling RSE issue. */
  repo: string;
  rules?: Rule[];
  now?: Date;
  timeoutMs?: number;
}

/** One nightly run: check every listed repo, then upsert the rolling RSE issue. */
export async function runFairJob(opts: JobOptions): Promise<{ report: FairReport; issue: UpsertOutcome }> {
  const report = await runFairCheck(opts.registry, opts.gh, {
    rules: opts.rules ?? defaultRules,
    now: opts.now,
    timeoutMs: opts.timeoutMs,
  });
  const issue = await upsertIssue(opts.gh, {
    repo: opts.repo,
    label: REPORT_LABEL,
    title: REPORT_TITLE,
    body: renderReport(report),
  });
  return { report, issue };
}
