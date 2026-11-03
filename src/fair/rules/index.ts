import type { Rule } from '../types.ts';
import { licence } from './licence.ts';

/**
 * The FAIR4RS rule registry, in report order. To add an indicator: write
 * rules/<indicator>.ts exporting a Rule, add tests/unit/fair/<indicator>.test.ts
 * with met / unmet / unknown cases on recorded fixtures, and list it here.
 */
export const rules: Rule[] = [licence];
