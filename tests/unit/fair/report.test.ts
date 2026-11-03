import { describe, expect, it } from 'vitest';
import type { FairReport } from '../../../src/fair/check.ts';
import { renderReport } from '../../../src/fair/report.ts';

const report: FairReport = {
  generated_at: '2026-11-03T02:00:00.000Z',
  rules: [{ indicator: 'licence', title: 'Licence' }],
  projects: [
    { id: 'p1', name: 'Am AI Right', repos: [] },
    {
      id: 'p2',
      name: 'CLE',
      repos: [
        {
          listed: 'https://github.com/cli/cli',
          repo: { owner: 'cli', name: 'cli', url: 'https://github.com/cli/cli' },
          results: [
            { indicator: 'licence', state: 'met', evidence_url: 'https://github.com/cli/cli/blob/trunk/LICENSE', detail: 'MIT licence detected' },
          ],
        },
        {
          listed: 'https://github.com/octocat/Hello-World',
          repo: { owner: 'octocat', name: 'Hello-World', url: 'https://github.com/octocat/Hello-World' },
          results: [{ indicator: 'licence', state: 'unknown', evidence_url: null, detail: 'Could not check (rate_limited)' }],
        },
        { listed: 'https://gitlab.com/a/b', repo: null, invalid: true, results: [] },
      ],
    },
  ],
};

describe('renderReport', () => {
  const body = renderReport(report);

  it('frames FAIR as evidence per indicator, never as compliance', () => {
    expect(body).toContain('FAIR evidence');
    expect(body).not.toMatch(/\bcompliant\b/i);
    expect(body).toContain('2026-11-03T02:00:00.000Z');
  });

  it('lists projects without repos as "no repos listed"', () => {
    expect(body).toMatch(/## Am AI Right\s+_No repos listed\._/);
  });

  it('shows each indicator state with its evidence link and a met count per repo', () => {
    expect(body).toContain('[cli/cli](https://github.com/cli/cli): 1 of 1 met');
    expect(body).toContain('| Licence | met | [evidence](https://github.com/cli/cli/blob/trunk/LICENSE) MIT licence detected |');
    expect(body).toContain('| Licence | unknown | Could not check (rate_limited) |');
  });

  it('flags repo entries that are not GitHub repos', () => {
    expect(body).toContain('`https://gitlab.com/a/b`: not a GitHub repo, not checked');
  });

  it('escapes markdown table and HTML characters coming from the registry', () => {
    const nasty = renderReport({ ...report, projects: [{ id: 'x', name: 'A|B <script>', repos: [] }] });
    expect(nasty).toContain('## A\\|B &lt;script&gt;');
  });
});
