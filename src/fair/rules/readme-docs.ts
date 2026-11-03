import type { Rule } from '../types.ts';
import { absentOrUnknown, decodeFile, repoPath, resultFor } from './shared.ts';

const result = resultFor('readme_docs');

export const MIN_README_CHARS = 500;

/** A docs URL in the README (Read the Docs, GitHub Pages, or a /docs path) counts as supporting evidence. */
const DOCS_URL = /https?:\/\/[^\s)\]>"']*(?:readthedocs\.(?:io|org)|\.github\.io|\/docs\b)[^\s)\]>"']*/i;

/**
 * README and docs (one indicator): the README has at least 500 characters.
 * A `docs/` folder or a docs URL is recorded as supporting evidence only; it
 * never changes the state.
 */
export const readmeDocs: Rule = {
  indicator: 'readme_docs',
  title: 'README and docs',
  async check(repo, gh) {
    const res = await gh.request('GET', repoPath(repo, '/readme'));
    if (res.status !== 200) return absentOrUnknown('readme_docs', res, repo, gh, 'No README found');
    const readme = decodeFile(res.data);
    const length = readme.text.length;

    const supporting: string[] = [];
    const docs = await gh.request('GET', repoPath(repo, '/contents/docs'));
    if (docs.status === 200 && Array.isArray(docs.data)) supporting.push('docs/ folder found');
    const docsUrl = [...readme.text.matchAll(new RegExp(DOCS_URL, 'gi'))].map((m) => m[0]).find((u) => !/badge/i.test(u));
    if (docsUrl) supporting.push(`docs URL ${docsUrl}`);
    const extra = supporting.length ? `; ${supporting.join('; ')}` : '';

    if (length >= MIN_README_CHARS) return result('met', readme.html_url, `README has ${length} characters${extra}`);
    return result('unmet', readme.html_url, `README has only ${length} characters (needs ${MIN_README_CHARS})${extra}`);
  },
};
