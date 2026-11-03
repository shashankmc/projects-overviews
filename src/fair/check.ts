import { NetworkError, thrownErrorClass, unknownResult, type ErrorClass } from './errors.ts';
import { DEFAULT_TIMEOUT_MS } from './fetch.ts';
import type { GitHubClient, HttpClient, IndicatorResult, RepoRef, Rule, RuleContext } from './types.ts';

/** The slice of data/registry.json the FAIR check reads. `repos` is optional until the RSE backfills it. */
export interface RegistryInput {
  projects: { id: string; name: string; repos?: string[] }[];
}

export interface RepoReport {
  /** The entry exactly as listed in the registry. */
  listed: string;
  repo: RepoRef | null;
  /** True when `listed` is not a recognisable GitHub repo; no rules ran. */
  invalid?: true;
  results: IndicatorResult[];
}

export interface ProjectReport {
  id: string;
  name: string;
  /** Empty means the project lists no repos ("no repos listed"), which is not a failure. */
  repos: RepoReport[];
}

export interface FairReport {
  generated_at: string;
  rules: { indicator: string; title: string }[];
  projects: ProjectReport[];
  /**
   * Checks that threw something other than a timeout or network failure (a bug,
   * an unexpected payload). They read `unknown (internal_error)` in the report;
   * the job fails the run after writing it.
   */
  internal_errors: { listed: string; indicator: string }[];
}

export interface CheckOptions {
  rules: Rule[];
  now?: Date;
  /** Per-rule timeout; past it the indicator is unknown (spec: 10 s per external call). */
  timeoutMs?: number;
  /**
   * Client for non-GitHub lookups (Zenodo, PyPI, CRAN, npm, Software Heritage).
   * Defaults to one that refuses every call, so those indicators read unknown
   * and nothing reaches the network unless a client is passed explicitly.
   */
  http?: HttpClient;
}

/** Behaves like an unreachable network, so the lookup reads unknown (network_error) rather than failing the run. */
const noHttp: HttpClient = {
  get: async () => {
    throw new NetworkError('No HttpClient configured');
  },
};

/** Accepts `https://github.com/<owner>/<name>[.git][/]` or `<owner>/<name>`. */
export function parseRepoRef(listed: string): RepoRef | null {
  const m = /^(?:https?:\/\/(?:www\.)?github\.com\/)?([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+?)(?:\.git)?\/?$/.exec(listed.trim());
  if (!m) return null;
  const [, owner, name] = m as unknown as [string, string, string];
  return { owner, name, url: `https://github.com/${owner}/${name}` };
}

/** Runs one rule under the per-rule timeout; `error` is set when the rule threw or timed out. */
async function runRule(
  rule: Rule,
  repo: RepoRef,
  gh: GitHubClient,
  ctx: RuleContext,
  timeoutMs: number,
): Promise<{ result: IndicatorResult; error?: ErrorClass }> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<'timeout'>((resolve) => {
    timer = setTimeout(() => resolve('timeout'), timeoutMs);
  });
  let error: ErrorClass;
  try {
    const outcome = await Promise.race([rule.check(repo, gh, ctx), timeout]);
    if (outcome !== 'timeout') return { result: outcome };
    error = 'timeout';
  } catch (err) {
    // No catch-all: only timeouts and network failures are expected; anything else is internal_error.
    error = thrownErrorClass(err);
  } finally {
    clearTimeout(timer);
  }
  return { result: unknownResult(rule.indicator, error), error };
}

export async function runFairCheck(registry: RegistryInput, gh: GitHubClient, options: CheckOptions): Promise<FairReport> {
  const { rules, now = new Date(), timeoutMs = DEFAULT_TIMEOUT_MS, http = noHttp } = options;
  const ctx: RuleContext = { http, now };
  const projects: ProjectReport[] = [];
  const internal_errors: FairReport['internal_errors'] = [];
  for (const project of registry.projects) {
    const repos: RepoReport[] = [];
    for (const listed of project.repos ?? []) {
      const repo = parseRepoRef(listed);
      if (!repo) {
        repos.push({ listed, repo: null, invalid: true, results: [] });
        continue;
      }
      const results: IndicatorResult[] = [];
      for (const rule of rules) {
        const { result, error } = await runRule(rule, repo, gh, ctx, timeoutMs);
        if (error === 'internal_error') internal_errors.push({ listed, indicator: rule.indicator });
        results.push(result);
      }
      repos.push({ listed, repo, results });
    }
    projects.push({ id: project.id, name: project.name, repos });
  }
  return {
    generated_at: now.toISOString(),
    rules: rules.map(({ indicator, title }) => ({ indicator, title })),
    projects,
    internal_errors,
  };
}
