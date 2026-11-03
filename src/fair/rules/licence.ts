import { errorClassOf, unknownResult } from '../errors.ts';
import type { IndicatorResult, Rule } from '../types.ts';

interface LicenseResponse {
  html_url: string;
  license: { spdx_id: string | null; name: string } | null;
}

const result = (state: IndicatorResult['state'], evidence_url: string | null, detail: string): IndicatorResult => ({
  indicator: 'licence',
  state,
  evidence_url,
  detail,
});

/** licence: an SPDX-detectable LICENSE* file, per GitHub's license API. */
export const licence: Rule = {
  indicator: 'licence',
  title: 'Licence',
  async check(repo, gh) {
    const res = await gh.request('GET', `/repos/${repo.owner}/${repo.name}/license`);
    if (res.status === 200) {
      const data = res.data as LicenseResponse;
      const spdx = data.license?.spdx_id;
      if (spdx && spdx !== 'NOASSERTION') return result('met', data.html_url, `${spdx} licence detected`);
      return result('unmet', data.html_url, 'Licence file found but its licence is not SPDX-detectable');
    }
    if (res.status === 404) {
      // 404 means "no licence" only if the repo itself is visible.
      const repoRes = await gh.request('GET', `/repos/${repo.owner}/${repo.name}`);
      if (repoRes.status === 200) return result('unmet', repo.url, 'No licence file found');
      return unknownResult('licence', errorClassOf(repoRes));
    }
    return unknownResult('licence', errorClassOf(res));
  },
};
