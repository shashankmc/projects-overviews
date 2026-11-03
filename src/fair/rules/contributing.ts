import { errorClassOf, unknownResult } from '../errors.ts';
import type { Rule } from '../types.ts';
import { repoPath, resultFor } from './shared.ts';

const result = resultFor('contributing');

interface CommunityProfile {
  files: { contributing: { html_url: string } | null };
}

/**
 * contributing: a `CONTRIBUTING*` file exists. Uses GitHub's community profile,
 * which looks in the root, `docs/` and `.github/` like GitHub itself does.
 */
export const contributing: Rule = {
  indicator: 'contributing',
  title: 'Contributing guide',
  async check(repo, gh) {
    const res = await gh.request('GET', repoPath(repo, '/community/profile'));
    // Answers 200 for every visible public repo, so any other status is unknown.
    if (res.status !== 200) return unknownResult('contributing', errorClassOf(res));
    const file = (res.data as CommunityProfile).files?.contributing;
    if (file) return result('met', file.html_url, 'Contributing guide found');
    return result('unmet', `${repo.url}/community`, 'No CONTRIBUTING file found');
  },
};
