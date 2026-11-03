// Entry point for the nightly FAIR workflow: `npm run fair`.
// Env: GITHUB_TOKEN (required), GITHUB_REPOSITORY (owner/name for the issue, set by Actions),
// REGISTRY_PATH (default data/registry.json), FAIR_DRY_RUN=1 prints the issue body instead of writing it.
// Exits non-zero (after writing or printing the report) if any check hit an internal_error.
import { readFile } from 'node:fs/promises';
import type { RegistryInput } from './check.ts';
import { createGitHubClient } from './github.ts';
import { createHttpClient } from './http.ts';
import { InternalErrorsFound, runFairJob, type JobResult } from './job.ts';

const token = process.env.GITHUB_TOKEN;
const repo = process.env.GITHUB_REPOSITORY;
const registryPath = process.env.REGISTRY_PATH ?? 'data/registry.json';
const dryRun = process.env.FAIR_DRY_RUN === '1';

if (!token) throw new Error('GITHUB_TOKEN is required');
if (!dryRun && !repo) throw new Error('GITHUB_REPOSITORY (owner/name) is required');

const registry = JSON.parse(await readFile(registryPath, 'utf8')) as RegistryInput;

function summarise({ report, body, issue }: JobResult): void {
  if (!issue) {
    console.log(body);
    return;
  }
  const repos = report.projects.reduce((n, p) => n + p.repos.length, 0);
  const missing = report.projects.filter((p) => p.repos.length === 0).length;
  console.log(`FAIR check: ${repos} repo(s) checked, ${missing} project(s) with no repos listed; issue #${issue.number} ${issue.action}.`);
}

try {
  summarise(await runFairJob({ registry, gh: createGitHubClient({ token }), http: createHttpClient(), repo: repo ?? '', dryRun }));
} catch (err) {
  if (!(err instanceof InternalErrorsFound)) throw err;
  summarise(err.result);
  console.error(`FAIR check failed: ${err.message}`);
  process.exitCode = 1;
}
