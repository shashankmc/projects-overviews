import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { inlineScriptHashes, readCsp } from '../../scripts/csp.mjs';

// Record every CSP violation the browser reports, from the first byte of the page.
async function recordViolations(page: Page) {
  await page.addInitScript(() => {
    (window as any).__cspViolations = [];
    document.addEventListener('securitypolicyviolation', e => {
      (window as any).__cspViolations.push(`${e.violatedDirective} ${e.blockedURI}`);
    });
  });
}
const violations = (page: Page) => page.evaluate(() => (window as any).__cspViolations as string[]);

test('the page sets a CSP that forbids inline script it does not ship', async ({ page }) => {
  await page.goto('/');
  const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
  expect(csp).toBeTruthy();
  const scriptSrc = csp!.split(';').map(d => d.trim()).find(d => d.startsWith('script-src '));
  expect(scriptSrc).toBeDefined();
  expect(scriptSrc).not.toContain("'unsafe-inline'");
  expect(scriptSrc).not.toContain("'unsafe-eval'");
  expect(csp).toContain("object-src 'none'");
  expect(csp).toContain("base-uri 'none'");
});

test('every tab renders with zero CSP violations', async ({ page }) => {
  await recordViolations(page);
  await page.goto('/');
  await expect(page.locator('#projList .pitem')).toHaveCount(6);
  for (const tab of ['Relations', 'Catalogue', 'Projects']) {
    await page.getByRole('button', { name: tab, exact: true }).click();
  }
  await page.locator('#projList .pitem', { hasText: 'BlueLab' }).click();
  expect(await violations(page)).toEqual([]);
});

test('injected markup cannot run inline script', async ({ page }) => {
  await recordViolations(page);
  await page.goto('/');
  await expect(page.locator('#projList .pitem')).toHaveCount(6);
  await page.evaluate(() => {
    (window as any).__pwned = false;
    // What a stored-XSS payload would look like if text ever reached innerHTML unescaped.
    document.getElementById('projDetail')!.insertAdjacentHTML(
      'beforeend',
      '<img src="/no-such-image" onerror="window.__pwned=true"><a id="xss" href="javascript:window.__pwned=true">x</a>',
    );
    const s = document.createElement('script');
    s.textContent = 'window.__pwned = true';
    document.body.appendChild(s);
  });
  await page.locator('#xss').click();
  await expect.poll(() => violations(page)).not.toEqual([]);
  expect(await page.evaluate(() => (window as any).__pwned)).toBe(false);
});

test("the CSP hashes match index.html's inline scripts (run `npm run csp` after editing them)", async () => {
  const html = await readFile(new URL('../../index.html', import.meta.url), 'utf8');
  const allowed = readCsp(html)?.['script-src'] ?? [];
  expect(allowed.filter(s => s.startsWith("'sha256-")).sort()).toEqual(inlineScriptHashes(html).sort());
});
