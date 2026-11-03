import type { FairReport, RepoReport } from './check.ts';
import type { IndicatorResult } from './types.ts';

/** Escapes text from the registry or APIs for a GitHub-flavoured markdown table cell or heading. */
function md(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function code(text: string): string {
  return '`' + text.replace(/`/g, "'") + '`';
}

function cell(r: IndicatorResult): string {
  const detail = md(r.detail);
  return r.evidence_url ? `[evidence](${encodeURI(r.evidence_url)}) ${detail}` : detail;
}

function renderRepo(entry: RepoReport, titles: Map<string, string>): string[] {
  if (!entry.repo) return [`- ${code(entry.listed)}: not a GitHub repo, not checked`, ''];
  const met = entry.results.filter((r) => r.state === 'met').length;
  const name = `${entry.repo.owner}/${entry.repo.name}`;
  return [
    `### [${md(name)}](${entry.repo.url}): ${met} of ${entry.results.length} met`,
    '',
    '| Indicator | State | Evidence |',
    '|---|---|---|',
    ...entry.results.map((r) => `| ${md(titles.get(r.indicator) ?? r.indicator)} | ${r.state} | ${cell(r)} |`),
    '',
  ];
}

/** Markdown body of the rolling RSE issue. */
export function renderReport(report: FairReport): string {
  const titles = new Map(report.rules.map((r) => [r.indicator, r.title]));
  const lines = [
    '# FAIR evidence report',
    '',
    `Generated ${report.generated_at} by the nightly FAIR check. ` +
      'Each indicator is evidence, not a verdict: **met** links the proof, **unmet** links where we looked, ' +
      '**unknown** means the check could not run (for example a GitHub error) and says nothing about the repo.',
    '',
    `Indicators checked: ${report.rules.map((r) => md(r.title)).join(', ')}.`,
    '',
  ];
  for (const project of report.projects) {
    lines.push(`## ${md(project.name)}`, '');
    if (project.repos.length === 0) {
      lines.push('_No repos listed._', '');
      continue;
    }
    for (const entry of project.repos) lines.push(...renderRepo(entry, titles));
  }
  return lines.join('\n');
}
