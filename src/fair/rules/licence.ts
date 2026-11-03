import type { Rule } from '../types.ts';
import { absentOrUnknown, repoPath, resultFor } from './shared.ts';

const result = resultFor('licence');

interface LicenseResponse {
  html_url: string;
  license: { spdx_id: string | null; name: string } | null;
}

/** licence: an SPDX-detectable LICENSE* file, per GitHub's license API. */
export const licence: Rule = {
  indicator: 'licence',
  title: 'Licence',
  async check(repo, gh) {
    const res = await gh.request('GET', repoPath(repo, '/license'));
    if (res.status !== 200) return absentOrUnknown('licence', res, repo, gh, 'No licence file found');
    const data = res.data as LicenseResponse;
    const spdx = data.license?.spdx_id;
    if (spdx && spdx !== 'NOASSERTION') return result('met', data.html_url, `${spdx} licence detected`);
    return result('unmet', data.html_url, 'Licence file found but its licence is not SPDX-detectable');
  },
};
