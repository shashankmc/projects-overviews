// Keeps the Content-Security-Policy <meta> in index.html in step with its inline scripts.
// GitHub Pages cannot send headers, so the CSP is a <meta> tag and inline scripts are
// allowed by SHA-256 hash only. Run `npm run csp` after editing any inline <script>.
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const META = /(<meta http-equiv="Content-Security-Policy" content=")([^"]*)(">)/;

/** CSP source tokens ('sha256-...') for every inline (non-src) <script> in the HTML. */
export function inlineScriptHashes(html) {
  return [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(
    m => `'sha256-${createHash('sha256').update(m[1], 'utf8').digest('base64')}'`,
  );
}

/** The CSP meta policy as { directive: [sources] }, or null when the page has none. */
export function readCsp(html) {
  const m = html.match(META);
  if (!m) return null;
  return Object.fromEntries(
    m[2].split(';').map(d => d.trim().split(/\s+/)).filter(p => p[0]).map(([k, ...v]) => [k, v]),
  );
}

/** Rewrites script-src to exactly the current inline script hashes. */
export function syncCsp(html) {
  const m = html.match(META);
  if (!m) throw new Error('index.html has no Content-Security-Policy <meta> tag');
  const policy = m[2].replace(/script-src[^;]*/, `script-src ${inlineScriptHashes(html).join(' ')}`);
  return html.replace(META, `$1${policy}$3`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const file = process.argv[2] ?? 'index.html';
  const html = await readFile(file, 'utf8');
  const next = syncCsp(html);
  if (next !== html) await writeFile(file, next);
  console.log(`${file}: script-src ${inlineScriptHashes(next).join(' ')}`);
}
