import { parseDocument } from 'yaml';
import type { Rule } from '../types.ts';
import { absentOrUnknown, decodeFile, repoPath, resultFor } from './shared.ts';

const result = resultFor('citation');

/** citation: `CITATION.cff` exists at the repo root and parses (a YAML mapping with `cff-version`). */
export const citation: Rule = {
  indicator: 'citation',
  title: 'CITATION.cff',
  async check(repo, gh) {
    const res = await gh.request('GET', repoPath(repo, '/contents/CITATION.cff'));
    if (res.status !== 200) return absentOrUnknown('citation', res, repo, gh, 'No CITATION.cff found');
    const file = decodeFile(res.data);
    const doc = parseDocument(file.text, { prettyErrors: true });
    const [error] = doc.errors;
    if (error) return result('unmet', file.html_url, `CITATION.cff present but invalid (line ${error.linePos?.[0].line ?? '?'})`);
    const parsed: unknown = doc.toJS();
    if (!parsed || typeof parsed !== 'object' || !('cff-version' in parsed)) {
      return result('unmet', file.html_url, 'CITATION.cff present but invalid (no cff-version)');
    }
    return result('met', file.html_url, 'CITATION.cff parses');
  },
};
