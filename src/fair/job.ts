import { runFairCheck, type FairReport, type RegistryInput } from './check.ts';
import { upsertIssue, type UpsertOutcome } from './issue.ts';
import { renderReport } from './report.ts';
import { rules as defaultRules } from './rules/index.ts';
import type { GitHubClient, HttpClient, Rule } from './types.ts';

export const REPORT_LABEL = 'fair-report';
export const REPORT_TITLE = 'FAIR evidence report (nightly)';

export interface JobOptions {
  registry: RegistryInput;
  gh: GitHubClient;
  /** `owner/name` of the repo that holds the rolling RSE issue. */
  repo: string;
  /** Non-GitHub lookups (Zenodo, PyPI, CRAN, npm, Software Heritage); without it those indicators read unknown. */
  http?: HttpClient;
  rules?: Rule[];
  now?: Date;
  timeoutMs?: number;
  /** Render the issue body but write nothing. */
  dryRun?: boolean;
}

export interface JobResult {
  report: FairReport;
  body: string;
  /** Null on a dry run. */
  issue: UpsertOutcome | null;
}

/** Thrown after the report is written (or printed) when any check hit an internal_error. */
export class InternalErrorsFound extends Error {
  readonly result: JobResult;
  constructor(result: JobResult) {
    const where = result.report.internal_errors.map((e) => `${e.listed} ${e.indicator}`).join(', ');
    super(`internal_error in ${result.report.internal_errors.length} check(s): ${where}`);
    this.name = 'InternalErrorsFound';
    this.result = result;
  }
}

/**
 * One nightly run: check every listed repo, then upsert the rolling RSE issue.
 * Internal errors are shown in the issue as unknown, then fail the run loudly
 * (throws InternalErrorsFound) so they are never silently absorbed.
 */
export async function runFairJob(opts: JobOptions): Promise<JobResult> {
  const report = await runFairCheck(opts.registry, opts.gh, {
    rules: opts.rules ?? defaultRules,
    now: opts.now,
    timeoutMs: opts.timeoutMs,
    http: opts.http,
  });
  const body = renderReport(report);
  const issue = opts.dryRun
    ? null
    : await upsertIssue(opts.gh, { repo: opts.repo, label: REPORT_LABEL, title: REPORT_TITLE, body });
  const result = { report, body, issue };
  if (report.internal_errors.length) throw new InternalErrorsFound(result);
  return result;
}
