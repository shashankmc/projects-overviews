import type { Rule } from '../types.ts';
import { activity } from './activity.ts';
import { citation } from './citation.ts';
import { contributing } from './contributing.ts';
import { dependencies } from './dependencies.ts';
import { install } from './install.ts';
import { licence } from './licence.ts';
import { metadata } from './metadata.ts';
import { pid } from './pid.ts';
import { readmeDocs } from './readme-docs.ts';
import { registry } from './registry.ts';
import { releases } from './releases.ts';
import { testsCi } from './tests-ci.ts';

/**
 * The 12 automatable FAIR4RS indicators (spec: "FAIR evidence detection rules"),
 * in report order. To add an indicator: write rules/<indicator>.ts exporting a
 * Rule, add tests/unit/fair/<indicator>.test.ts with met / unmet / unknown cases
 * on recorded fixtures, and list it here.
 */
export const rules: Rule[] = [
  licence,
  citation,
  metadata,
  pid,
  registry,
  readmeDocs,
  install,
  testsCi,
  releases,
  dependencies,
  contributing,
  activity,
];
