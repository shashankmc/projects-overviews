import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const load = (name: string) => parse(readFileSync(new URL(`../../../.github/workflows/${name}`, import.meta.url), 'utf8'));
const wf = load('heartbeat.yml');
const steps = (): any[] => Object.values<any>(wf.jobs).flatMap((j) => j.steps);

describe('heartbeat.yml workflow', () => {
  it('runs weekly and on manual dispatch only', () => {
    expect(Object.keys(wf.on).sort()).toEqual(['schedule', 'workflow_dispatch']);
    expect(wf.on.schedule).toHaveLength(1);
    // minute hour * * <day-of-week> : once a week
    expect(wf.on.schedule[0].cron).toMatch(/^\d+ \d+ \* \* [0-6]$/);
  });

  it('grants nothing at workflow level and only contents: write + actions: read to the job', () => {
    expect(wf.permissions).toEqual({});
    for (const job of Object.values<any>(wf.jobs)) {
      expect(job.permissions).toEqual({ contents: 'write', actions: 'read' });
    }
  });

  it('only ever pushes from main', () => {
    for (const job of Object.values<any>(wf.jobs)) expect(job.if).toBe("github.ref == 'refs/heads/main'");
    const push = steps().find((s) => String(s.run).includes('git push'));
    expect(push.run).toContain('git push origin HEAD:main');
  });

  it('skips the commit when the status file did not change', () => {
    const push = steps().find((s) => String(s.run).includes('git push'));
    expect(push.run).toContain('git diff --cached --quiet');
  });

  it('never interpolates ${{ }} expressions into run: scripts', () => {
    for (const step of steps()) if (step.run) expect(step.run).not.toContain('${{');
  });

  it('pins every Action to a full commit SHA', () => {
    const uses = steps().filter((s) => s.uses).map((s) => s.uses);
    expect(uses.length).toBeGreaterThan(0);
    for (const u of uses) expect(u).toMatch(/^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/);
  });

  it('keeps checkout credentials, because the job pushes', () => {
    const checkout = steps().find((s) => String(s.uses).startsWith('actions/checkout'));
    expect(checkout.with['persist-credentials']).toBe(true);
  });

  it('does not redeploy Pages for a heartbeat push', () => {
    // GITHUB_TOKEN pushes trigger no workflows today; the paths-ignore keeps that true
    // if the push is ever made with an App token instead (spec: paths-ignore status/**).
    const pages = load('pages.yml');
    expect(pages.on.push['paths-ignore']).toContain('status/**');
  });
});
