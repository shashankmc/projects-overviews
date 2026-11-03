// Entry point for the weekly keep-alive workflow: `npm run heartbeat`.
// Env: GITHUB_TOKEN (required, needs actions: read), GITHUB_REPOSITORY (owner/name, set by Actions),
// HEARTBEAT_PATH (default status/heartbeat.json).
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createGitHubClient } from '../fair/github.ts';
import { buildHeartbeat } from './status.ts';

const token = process.env.GITHUB_TOKEN;
const repo = process.env.GITHUB_REPOSITORY;
const path = process.env.HEARTBEAT_PATH ?? 'status/heartbeat.json';

if (!token) throw new Error('GITHUB_TOKEN is required');
if (!repo) throw new Error('GITHUB_REPOSITORY (owner/name) is required');

const heartbeat = await buildHeartbeat({ gh: createGitHubClient({ token }), repo, now: new Date() });
await mkdir(dirname(path), { recursive: true });
await writeFile(path, JSON.stringify(heartbeat, null, 2) + '\n');
console.log(`Heartbeat ${heartbeat.generated_at}: last FAIR run ${heartbeat.fair_last_run.result}; wrote ${path}.`);
