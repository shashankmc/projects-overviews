import { describe, expect, it } from 'vitest';
import { upsertIssue } from '../../../src/fair/issue.ts';
import { fakeIssuesRepo } from './fake-issues.ts';

const target = { repo: 'shashankmc/projects-overviews', label: 'fair-report', title: 'FAIR evidence report' };
const openReports = (issues: ReturnType<typeof fakeIssuesRepo>['issues']) =>
  issues.filter((i) => i.state === 'open' && i.labels.some((l) => l.name === 'fair-report') && !i.pull_request);

describe('upsertIssue', () => {
  it('creates the labelled issue when none is open', async () => {
    const gh = fakeIssuesRepo(target.repo);
    const outcome = await upsertIssue(gh.client, { ...target, body: 'night 1' });
    expect(outcome.action).toBe('created');
    expect(openReports(gh.issues)).toMatchObject([{ title: 'FAIR evidence report', body: 'night 1' }]);
  });

  it('running twice leaves exactly one open issue, updated with the latest body', async () => {
    const gh = fakeIssuesRepo(target.repo);
    await upsertIssue(gh.client, { ...target, body: 'night 1' });
    const second = await upsertIssue(gh.client, { ...target, body: 'night 2' });
    expect(second.action).toBe('updated');
    expect(openReports(gh.issues)).toMatchObject([{ body: 'night 2' }]);
    expect(gh.issues).toHaveLength(1);
  });

  it('ignores closed report issues, unlabelled issues and labelled pull requests', async () => {
    const gh = fakeIssuesRepo(target.repo, [
      { number: 1, title: 'old report', body: 'old', state: 'closed', labels: [{ name: 'fair-report' }] },
      { number: 2, title: 'bug', body: 'x', state: 'open', labels: [] },
      { number: 3, title: 'PR', body: 'y', state: 'open', labels: [{ name: 'fair-report' }], pull_request: {} },
    ]);
    const outcome = await upsertIssue(gh.client, { ...target, body: 'fresh' });
    expect(outcome).toMatchObject({ action: 'created', number: 4 });
    expect(gh.issues.find((i) => i.number === 1)!.body).toBe('old');
    expect(gh.issues.find((i) => i.number === 3)!.body).toBe('y');
  });

  it('throws on a GitHub error so the workflow run fails visibly', async () => {
    const client = { request: async () => ({ status: 403, data: { message: 'Resource not accessible by integration' } }) };
    await expect(upsertIssue(client, { ...target, body: 'b' })).rejects.toThrow(/403/);
  });
});
