import { httpErrorClassOf, unknownResult } from '../errors.ts';
import type { RepoRef, Rule } from '../types.ts';
import { resultFor } from './shared.ts';

const result = resultFor('pid');

/** Lucene query for Zenodo records whose related identifier is a GitHub release of the repo. */
function zenodoQuery(repo: RepoRef): string {
  const prefix = `${repo.url}/tree/`.replace(/[^A-Za-z0-9]/g, '\\$&');
  return `metadata.related_identifiers.identifier:${prefix}*`;
}

/**
 * The GitHub–Zenodo integration archives each release as a record whose related
 * identifier is `https://github.com/<o>/<n>/tree/<tag>`; the search returns the
 * latest version of each concept.
 */
export const zenodoSearchUrl = (repo: RepoRef): string =>
  `https://zenodo.org/api/records?${new URLSearchParams({ q: zenodoQuery(repo), size: '10' })}`;

const zenodoSearchPage = (repo: RepoRef): string => `https://zenodo.org/search?${new URLSearchParams({ q: zenodoQuery(repo) })}`;

interface ZenodoRecord {
  conceptdoi?: string;
  doi?: string;
  metadata?: { related_identifiers?: { identifier?: string }[] };
}

/** persistent identifier: a release with a Zenodo DOI, from the GitHub–Zenodo concept DOI lookup. */
export const pid: Rule = {
  indicator: 'pid',
  title: 'DOI-bearing release',
  async check(repo, _gh, { http }) {
    const res = await http.get(zenodoSearchUrl(repo));
    if (res.status !== 200) return unknownResult('pid', httpErrorClassOf(res));
    const hits = (res.data as { hits?: { hits?: ZenodoRecord[] } }).hits?.hits ?? [];
    const prefix = `${repo.url}/tree/`.toLowerCase();
    const record = hits.find((h) =>
      (h.metadata?.related_identifiers ?? []).some((r) => r.identifier?.toLowerCase().startsWith(prefix)),
    );
    const doi = record?.conceptdoi ?? record?.doi;
    if (doi) return result('met', `https://doi.org/${doi}`, `Zenodo concept DOI ${doi}`);
    return result('unmet', zenodoSearchPage(repo), 'No Zenodo record of a GitHub release found');
  },
};
