import { describe, expect, it } from 'vitest';
import { rules } from '../../../src/fair/rules/index.ts';

describe('the FAIR4RS rule registry', () => {
  it('has the 12 automatable indicators from the spec, in scorecard order', () => {
    expect(rules.map((r) => r.indicator)).toEqual([
      'licence',
      'citation',
      'metadata',
      'pid',
      'registry',
      'readme_docs',
      'install',
      'tests_ci',
      'releases',
      'dependencies',
      'contributing',
      'activity',
    ]);
  });

  it('gives every indicator a distinct report title', () => {
    expect(new Set(rules.map((r) => r.title)).size).toBe(12);
  });
});
