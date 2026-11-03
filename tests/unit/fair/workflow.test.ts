import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const wf = parse(readFileSync(new URL('../../../.github/workflows/fair.yml', import.meta.url), 'utf8'));

describe('fair.yml workflow', () => {
  it('runs nightly and on manual dispatch only', () => {
    expect(Object.keys(wf.on).sort()).toEqual(['schedule', 'workflow_dispatch']);
    expect(wf.on.schedule).toHaveLength(1);
    // minute hour * * * : once a day
    expect(wf.on.schedule[0].cron).toMatch(/^\d+ \d+ \* \* \*$/);
  });

  it('grants nothing at workflow level and only contents: read + issues: write to the job', () => {
    expect(wf.permissions).toEqual({});
    for (const job of Object.values<any>(wf.jobs)) {
      expect(job.permissions).toEqual({ contents: 'read', issues: 'write' });
    }
  });

  it('never interpolates ${{ }} expressions into run: scripts', () => {
    for (const job of Object.values<any>(wf.jobs)) {
      for (const step of job.steps) {
        if (step.run) expect(step.run).not.toContain('${{');
      }
    }
  });

  it('pins every Action to a full commit SHA', () => {
    const uses = Object.values<any>(wf.jobs).flatMap((j) => j.steps).filter((s) => s.uses).map((s) => s.uses);
    expect(uses.length).toBeGreaterThan(0);
    for (const u of uses) expect(u).toMatch(/^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/);
  });

  it('does not leave the token in the checkout', () => {
    const checkout = Object.values<any>(wf.jobs)
      .flatMap((j) => j.steps)
      .find((s) => String(s.uses).startsWith('actions/checkout'));
    expect(checkout.with['persist-credentials']).toBe(false);
  });
});
