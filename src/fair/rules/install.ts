import type { Rule } from '../types.ts';
import { absentOrUnknown, decodeFile, repoPath, resultFor } from './shared.ts';

const result = resultFor('install');

/**
 * "install", "installation" or "installing" as a whole word: not part of
 * "Uninstalling", "Installer" or a hyphenated word like "Pre-install".
 */
const INSTALL_WORD = String.raw`(?<![\w-])install(?:ation|ing)?(?![\w-])`;
/** A Markdown ATX heading (`## Installation`), setext heading (`Install\n---`) or RST-style underline containing that word. */
const INSTALL_HEADING = new RegExp(
  String.raw`^(?:#{1,6}[ \t]+[^\n]*${INSTALL_WORD}[^\n]*|[^\n]*${INSTALL_WORD}[^\n]*\n[=\-~^]{3,}[ \t]*)$`,
  'im',
);
/** Fenced code blocks, whose `# comment` lines are not headings. */
const FENCED_CODE = /^(`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:^\1[ \t]*$|(?![\s\S]))/gm;
const INSTALL_COMMAND = /\b(?:pip3? install|npm install|conda|docker)\b/i;

/**
 * install instructions: the README has an "install", "installation" or
 * "installing" heading (outside code blocks),
 * or contains `pip install`, `npm install`, `conda` or `docker`.
 */
export const install: Rule = {
  indicator: 'install',
  title: 'Install instructions',
  async check(repo, gh) {
    const res = await gh.request('GET', repoPath(repo, '/readme'));
    if (res.status !== 200) return absentOrUnknown('install', res, repo, gh, 'No README found');
    const readme = decodeFile(res.data);
    const heading = INSTALL_HEADING.exec(readme.text.replace(FENCED_CODE, ''));
    if (heading) return result('met', readme.html_url, `README heading "${heading[0].split('\n')[0]!.replace(/^#+\s*/, '').trim()}"`);
    const command = INSTALL_COMMAND.exec(readme.text);
    if (command) return result('met', readme.html_url, `README mentions "${command[0]}"`);
    return result('unmet', readme.html_url, 'README has no install heading or install command');
  },
};
