// Entry point for the nightly FAIR workflow: `npm run fair`.
// Env: GITHUB_TOKEN (required), GITHUB_REPOSITORY (owner/name for the issue, set by Actions),
// REGISTRY_PATH (default data/registry.json), FAIR_DRY_RUN=1 prints the issue body instead of writing it.
import { readFile } from 'node:fs/promises';
import { runFairCheck, type RegistryInput } from './check.ts';
import { createGitHubClient } from './github.ts';
import { runFairJob } from './job.ts';
import { renderReport } from './report.ts';
import { rules } from './rules/index.ts';

const token = process.env.GITHUB_TOKEN;
const repo = process.env.GITHUB_REPOSITORY;
const registryPath = process.env.REGISTRY_PATH ?? 'data/registry.json';
const dryRun = process.env.FAIR_DRY_RUN === '1';

if (!token) throw new Error('GITHUB_TOKEN is required');
if (!dryRun && !repo) throw new Error('GITHUB_REPOSITORY (owner/name) is required');

const registry = JSON.parse(await readFile(registryPath, 'utf8')) as RegistryInput;
const gh = createGitHubClient({ token });

if (dryRun) {
  console.log(renderReport(await runFairCheck(registry, gh, { rules })));
} else {
  const { report, issue } = await runFairJob({ registry, gh, repo: repo! });
  const repos = report.projects.reduce((n, p) => n + p.repos.length, 0);
  const missing = report.projects.filter((p) => p.repos.length === 0).length;
  console.log(`FAIR check: ${repos} repo(s) checked, ${missing} project(s) with no repos listed; issue #${issue.number} ${issue.action}.`);
}
