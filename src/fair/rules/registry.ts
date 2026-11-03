import { httpErrorClassOf, thrownErrorClass, unknownResult, type ErrorClass } from '../errors.ts';
import type { HttpClient, HttpResponse, RepoRef, Rule } from '../types.ts';
import { resultFor } from './shared.ts';

const result = resultFor('registry');

/** Software Heritage's archive search for the repo URL: where a human would look to confirm absence. */
const swhSearchPage = (repo: RepoRef): string => `https://archive.softwareheritage.org/browse/search/?${new URLSearchParams({ q: repo.url })}`;

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** True when any of `values` mentions github.com/<owner>/<name> (https, git+https, git@, ssh, with or without .git). */
export function pointsBack(repo: RepoRef, values: unknown[]): boolean {
  const re = new RegExp(
    `(?<![A-Za-z0-9-])github\\.com[/:]${escapeRe(repo.owner)}/${escapeRe(repo.name)}(?:\\.git)?(?![A-Za-z0-9_-]|\\.[A-Za-z0-9_-])`,
    'i',
  );
  return values.some((v) => typeof v === 'string' && re.test(v));
}

export interface RegistryLookup {
  label: string;
  url: string;
  /** Evidence URL when this lookup proves presence, else null. */
  match(data: unknown): string | null;
}

/**
 * Where the registry-presence rule looks, in report order. Packages are looked
 * up by the repo name (npm lower-cases it); the Software Heritage origin by the
 * repo URL.
 */
export function registryLookups(repo: RepoRef): Record<'pypi' | 'cran' | 'npm' | 'swh', RegistryLookup> {
  const name = encodeURIComponent(repo.name);
  const npmName = encodeURIComponent(repo.name.toLowerCase());
  return {
    pypi: {
      label: 'PyPI',
      url: `https://pypi.org/pypi/${name}/json`,
      match(data) {
        const info = (data as { info?: Record<string, unknown> }).info ?? {};
        const projectUrls = Object.values((info.project_urls as Record<string, unknown> | null) ?? {});
        const ok = pointsBack(repo, [info.home_page, info.download_url, ...projectUrls]);
        return ok ? `https://pypi.org/project/${String(info.name ?? repo.name)}/` : null;
      },
    },
    cran: {
      label: 'CRAN',
      url: `https://crandb.r-pkg.org/${name}`,
      match(data) {
        const d = data as { Package?: string; URL?: unknown; BugReports?: unknown };
        const fields = [d.URL, d.BugReports].flatMap((f) => (typeof f === 'string' ? f.split(/[\s,]+/) : []));
        return pointsBack(repo, fields) ? `https://cran.r-project.org/package=${d.Package ?? repo.name}` : null;
      },
    },
    npm: {
      label: 'npm',
      url: `https://registry.npmjs.org/${npmName}`,
      match(data) {
        const d = data as { name?: string; repository?: unknown; homepage?: unknown; bugs?: unknown };
        const repository = typeof d.repository === 'string' ? d.repository : (d.repository as { url?: unknown } | undefined)?.url;
        const bugs = typeof d.bugs === 'string' ? d.bugs : (d.bugs as { url?: unknown } | undefined)?.url;
        return pointsBack(repo, [repository, d.homepage, bugs]) ? `https://www.npmjs.com/package/${d.name ?? repo.name}` : null;
      },
    },
    swh: {
      label: 'Software Heritage',
      url: `https://archive.softwareheritage.org/api/1/origin/${repo.url}/get/`,
      // The origin endpoint only answers 200 for an archived origin with exactly this URL.
      match: () => `https://archive.softwareheritage.org/browse/origin/?origin_url=${repo.url}`,
    },
  };
}

type Outcome = { found: string | null } | { error: ErrorClass };

/** Performs one lookup: found (evidence URL or null for absent), or an expected error class. Internal errors throw. */
async function performLookup(http: HttpClient, lookup: RegistryLookup): Promise<Outcome> {
  let res: HttpResponse;
  try {
    res = await http.get(lookup.url);
  } catch (err) {
    const error = thrownErrorClass(err);
    // Not a timeout or network failure: a bug. Let the runner fail the run loudly.
    if (error === 'internal_error') throw err;
    return { error };
  }
  if (res.status === 404) return { found: null };
  if (res.status !== 200 || !res.data || typeof res.data !== 'object') return { error: httpErrorClassOf(res) };
  return { found: lookup.match(res.data) };
}

/**
 * registry presence: a PyPI/CRAN/npm package whose metadata points back to this
 * repo, or a Software Heritage origin for the repo URL. Same-named packages that
 * don't point back don't count. Lookups run in parallel; one failing lookup only
 * makes the result unknown if no other lookup proved presence.
 */
export const registry: Rule = {
  indicator: 'registry',
  title: 'Registry presence',
  async check(repo, _gh, { http }) {
    const all = Object.values(registryLookups(repo));
    const outcomes = await Promise.all(all.map((l) => performLookup(http, l)));
    const hits = all.flatMap((l, i) => {
      const o = outcomes[i]!;
      return 'found' in o && o.found ? [{ label: l.label, evidence: o.found }] : [];
    });
    if (hits.length) {
      return result('met', hits[0]!.evidence, `Found on ${hits.map((h) => h.label).join(', ')}`);
    }
    const failed = outcomes.find((o): o is { error: ErrorClass } => 'error' in o);
    if (failed) return unknownResult('registry', failed.error);
    return result('unmet', swhSearchPage(repo), `No PyPI, CRAN or npm package pointing back, and no Software Heritage origin`);
  },
};
