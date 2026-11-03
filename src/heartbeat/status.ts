import { errorClassOf, type ErrorClass } from '../fair/errors.ts';
import type { GitHubClient } from '../fair/types.ts';

/** Contents of status/heartbeat.json, committed weekly by .github/workflows/heartbeat.yml. */
export interface Heartbeat {
  generated_at: string;
  fair_last_run: FairRunSummary;
}

export interface FairRunSummary {
  /** A workflow-run conclusion (success, failure, cancelled, ...), `none` if fair.yml never completed, or `unknown` if the API call failed. */
  result: string;
  /** Set only when result is `unknown` because the API call failed. */
  error?: ErrorClass;
  run_id: number | null;
  started_at: string | null;
  url: string | null;
}

interface WorkflowRun {
  id: number;
  conclusion: string | null;
  run_started_at: string;
  html_url: string;
}

export interface HeartbeatOptions {
  gh: GitHubClient;
  /** owner/name of the repo running fair.yml. */
  repo: string;
  now: Date;
}

export async function buildHeartbeat({ gh, repo, now }: HeartbeatOptions): Promise<Heartbeat> {
  const generated_at = now.toISOString();
  let res;
  try {
    res = await gh.request(
      'GET',
      `/repos/${repo}/actions/workflows/fair.yml/runs?status=completed&per_page=1&exclude_pull_requests=true`,
    );
  } catch (err) {
    // The keep-alive commit must not depend on the API; record why the result is missing.
    const cls = err instanceof Error && err.name === 'TimeoutError' ? 'timeout' : 'network_error';
    return { generated_at, fair_last_run: unknownRun(cls) };
  }
  if (res.status < 200 || res.status >= 300) {
    return { generated_at, fair_last_run: unknownRun(errorClassOf(res)) };
  }
  const run = (res.data as { workflow_runs: WorkflowRun[] }).workflow_runs[0];
  return { generated_at, fair_last_run: run ? summarise(run) : NO_RUN };
}

const NO_RUN: FairRunSummary = { result: 'none', run_id: null, started_at: null, url: null };

function unknownRun(error: ErrorClass): FairRunSummary {
  return { result: 'unknown', error, run_id: null, started_at: null, url: null };
}

function summarise(run: WorkflowRun): FairRunSummary {
  return { result: run.conclusion ?? 'unknown', run_id: run.id, started_at: run.run_started_at, url: run.html_url };
}
