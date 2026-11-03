import type { Rule } from '../types.ts';
import { absentOrUnknown, decodeFile, repoPath, resultFor } from './shared.ts';

const result = resultFor('install');

/** A Markdown ATX heading (`## Installation`), setext heading (`Install\n---`) or RST-style underline. */
const INSTALL_HEADING = /^(?:#{1,6}[ \t]+[^\n]*\binstall(?:ation|ing)?\b[^\n]*|[^\n]*\binstall(?:ation|ing)?\b[^\n]*\n[=\-~^]{3,}[ \t]*)$/im;
const INSTALL_COMMAND = /\b(?:pip3? install|npm install|conda|docker)\b/i;

/**
 * install instructions: the README has an "install" or "installation" heading,
 * or contains `pip install`, `npm install`, `conda` or `docker`.
 */
export const install: Rule = {
  indicator: 'install',
  title: 'Install instructions',
  async check(repo, gh) {
    const res = await gh.request('GET', repoPath(repo, '/readme'));
    if (res.status !== 200) return absentOrUnknown('install', res, repo, gh, 'No README found');
    const readme = decodeFile(res.data);
    const heading = INSTALL_HEADING.exec(readme.text);
    if (heading) return result('met', readme.html_url, `README heading "${heading[0].split('\n')[0]!.replace(/^#+\s*/, '').trim()}"`);
    const command = INSTALL_COMMAND.exec(readme.text);
    if (command) return result('met', readme.html_url, `README mentions "${command[0]}"`);
    return result('unmet', readme.html_url, 'README has no install heading or install command');
  },
};
