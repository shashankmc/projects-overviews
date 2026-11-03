/** A GitHub repository a project lists in `repos`. */
export interface RepoRef {
  owner: string;
  name: string;
  /** Canonical https://github.com/<owner>/<name> URL. */
  url: string;
}

export interface GitHubResponse {
  status: number;
  data: unknown;
}

/**
 * The only way FAIR code talks to GitHub. Paths are REST paths relative to the
 * API root, e.g. `/repos/cli/cli/license`. Non-2xx statuses are returned, not
 * thrown; network failures and timeouts throw. Tests inject a recorded-fixture
 * client; production uses `createGitHubClient` in github.ts.
 */
export interface GitHubClient {
  request(method: 'GET' | 'POST' | 'PATCH', path: string, body?: unknown): Promise<GitHubResponse>;
}

/** Tri-state (A3-TRISTATE): `unknown` means we could not tell, never "not met". */
export type IndicatorState = 'met' | 'unmet' | 'unknown';

export interface IndicatorResult {
  indicator: string;
  state: IndicatorState;
  /** The file or URL that proves the state; null when nothing can be linked. */
  evidence_url: string | null;
  /** Short human-readable explanation shown in the report. */
  detail: string;
}

/** One FAIR4RS indicator. Add a module under src/fair/rules/ and list it in rules/index.ts. */
export interface Rule {
  indicator: string;
  /** Heading shown in the report. */
  title: string;
  check(repo: RepoRef, gh: GitHubClient): Promise<IndicatorResult>;
}
