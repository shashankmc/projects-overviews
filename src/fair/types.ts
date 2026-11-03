/** A GitHub repository a project lists in `repos`. */
export interface RepoRef {
  owner: string;
  name: string;
  /** Canonical https://github.com/<owner>/<name> URL. */
  url: string;
}

/** An HTTP answer from GitHub or any other service; JSON bodies are parsed, anything else is null. */
export interface HttpResponse {
  status: number;
  data: unknown;
}

export type GitHubResponse = HttpResponse;

/**
 * The only way FAIR code talks to GitHub. Paths are REST paths relative to the
 * API root, e.g. `/repos/cli/cli/license`. Non-2xx statuses are returned, not
 * thrown; network failures throw NetworkError and timeouts TimeoutError. Tests inject a recorded-fixture
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

/**
 * How FAIR rules reach non-GitHub services (Zenodo, PyPI, CRAN, npm, Software
 * Heritage). Absolute URLs, GET only. Like GitHubClient: non-2xx statuses are
 * returned, network failures and timeouts throw. Tests inject recorded fixtures;
 * production uses `createHttpClient` in http.ts.
 */
export interface HttpClient {
  get(url: string): Promise<HttpResponse>;
}

/** Everything a rule may need besides the repo and GitHub. */
export interface RuleContext {
  http: HttpClient;
  /** The run's clock, so time-based rules are deterministic in tests. */
  now: Date;
}

/** One FAIR4RS indicator. Add a module under src/fair/rules/ and list it in rules/index.ts. */
export interface Rule {
  indicator: string;
  /** Heading shown in the report. */
  title: string;
  check(repo: RepoRef, gh: GitHubClient, ctx: RuleContext): Promise<IndicatorResult>;
}
