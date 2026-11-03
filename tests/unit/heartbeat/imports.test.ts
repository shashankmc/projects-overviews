import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** Runtime (non-`import type`) module specifiers of a TypeScript source file. */
function runtimeImports(source: string): string[] {
  const specs: string[] = [];
  const re = /^\s*(?:import|export)\s+(?!type\s)(?:[^'";]*?\sfrom\s+)?['"]([^'"]+)['"]/gm;
  for (const m of source.matchAll(re)) specs.push(m[1]!);
  for (const m of source.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)) specs.push(m[1]!);
  return specs;
}

/** Every module reached at runtime from `entry`, as URLs, plus every bare (package) specifier seen. */
function importGraph(entry: URL): { files: string[]; packages: string[] } {
  const seen = new Set<string>();
  const packages = new Set<string>();
  const queue = [entry];
  while (queue.length) {
    const url = queue.pop()!;
    if (seen.has(url.href)) continue;
    seen.add(url.href);
    for (const spec of runtimeImports(readFileSync(url, 'utf8'))) {
      if (spec.startsWith('.')) queue.push(new URL(spec, url));
      else if (!spec.startsWith('node:')) packages.add(spec);
    }
  }
  return { files: [...seen], packages: [...packages] };
}

describe('heartbeat import graph', () => {
  // heartbeat.yml runs `npm run heartbeat` without `npm ci`: no package may be loaded at runtime.
  it('loads only node: builtins and local modules, never an npm package', () => {
    const graph = importGraph(new URL('../../../src/heartbeat/main.ts', import.meta.url));
    expect(graph.files.length).toBeGreaterThan(2);
    expect(graph.packages).toEqual([]);
  });

  it('does not pull in the FAIR runner or rules', () => {
    const { files } = importGraph(new URL('../../../src/heartbeat/main.ts', import.meta.url));
    expect(files.filter((f) => /\/fair\/(check|job|rules\/)/.test(f))).toEqual([]);
  });

  it('notices a package import (self-check of the scanner)', () => {
    expect(runtimeImports("import { parse } from 'yaml';\nimport type { X } from 'vitest';\nimport './a.ts';")).toEqual(['yaml', './a.ts']);
  });
});
