import type { Rule } from '../types.ts';
import { absentOrUnknown, decodeFile, repoPath, resultFor } from './shared.ts';

const result = resultFor('metadata');

/** Line of a JSON.parse error, from V8's "(line N column M)" or "at position N"; null if neither is given. */
function errorLine(err: unknown, text: string): number | null {
  const message = err instanceof Error ? err.message : '';
  const line = /\(line (\d+) column \d+\)/.exec(message);
  if (line) return Number(line[1]);
  const position = /at position (\d+)/.exec(message);
  if (position) return text.slice(0, Number(position[1])).split('\n').length;
  return null;
}

/** metadata: `codemeta.json` exists at the repo root and parses as a JSON object. */
export const metadata: Rule = {
  indicator: 'metadata',
  title: 'codemeta.json',
  async check(repo, gh) {
    const res = await gh.request('GET', repoPath(repo, '/contents/codemeta.json'));
    if (res.status !== 200) return absentOrUnknown('metadata', res, repo, gh, 'No codemeta.json found');
    const file = decodeFile(res.data);
    let parsed: unknown;
    try {
      parsed = JSON.parse(file.text);
    } catch (err) {
      const line = errorLine(err, file.text);
      return result('unmet', file.html_url, `codemeta.json present but invalid${line ? ` (line ${line})` : ''}`);
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return result('unmet', file.html_url, 'codemeta.json present but not a JSON object');
    }
    return result('met', file.html_url, 'codemeta.json parses');
  },
};
