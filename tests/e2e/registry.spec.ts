import { test, expect } from '@playwright/test';

const PROJECTS = [
  'Am AI Right',
  'Lawnotation',
  'BAIGLE',
  'CLE (Case Law Explorer)',
  'BlueLab',
  'JusticeBot',
];

// The prototype's storage key (index.html LS_KEY). A visitor may still carry an old copy.
const STALE_KEY = 'legal_nlp_uses_v3';

test('ignores a stale dataset in browser storage and never writes to storage', async ({ page }) => {
  await page.addInitScript(key => {
    // Only seed once per browser context, then record every later write.
    if (!sessionStorage.getItem('__seeded')) {
      localStorage.setItem(key, JSON.stringify({
        dataSources: [], techniques: [], components: [], current: 'p_stale',
        projects: [{ id: 'p_stale', name: 'Stale Local Project', type: 'software', uses: [], produces: [] }],
      }));
      sessionStorage.setItem('__seeded', '1');
    }
    (window as any).__storageWrites = [];
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k: string, v: string) {
      if (this === localStorage) (window as any).__storageWrites.push(k);
      return orig.call(this, k, v);
    };
  }, STALE_KEY);

  await page.goto('/');
  await expect(page.locator('#projList .pitem .nm')).toHaveText(PROJECTS);
  await expect(page.getByText('Stale Local Project')).toHaveCount(0);

  // Browse every tab and select another project; none of it may touch storage.
  await page.locator('#projList .pitem', { hasText: 'BlueLab' }).click();
  await page.getByRole('button', { name: 'Relations', exact: true }).click();
  await page.getByRole('button', { name: 'Catalogue', exact: true }).click();
  expect(await page.evaluate(() => (window as any).__storageWrites)).toEqual([]);
});

test('loads the published registry over HTTP and lists all 6 projects', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  const dataRequest = page.waitForResponse(r => r.url().endsWith('/data/registry.json') && r.ok());
  await page.goto('/');
  await dataRequest;
  await expect(page.locator('#projList .pitem .nm')).toHaveText(PROJECTS);
  for (const tab of ['Relations', 'Catalogue', 'Projects']) {
    await page.getByRole('button', { name: tab, exact: true }).click();
  }
  expect(errors).toEqual([]);
});

test('Relations tab lists exactly the 4 known ties plus the supply links', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#projList .pitem')).toHaveCount(6);
  await page.getByRole('button', { name: 'Relations', exact: true }).click();

  const rows = page.locator('#relBody .edgetable tbody tr');
  await expect(rows.first()).toBeVisible();
  const relations = await rows.evaluateAll(trs => trs.map(tr => {
    const [a, rel, b] = [...tr.querySelectorAll('td')].slice(0, 3).map(td => td.textContent!.trim());
    return { a, rel, b };
  }));

  const ties = relations
    .filter(r => r.rel.startsWith('shares'))
    .map(r => `${[r.a, r.b].sort().join(' <-> ')} ${r.rel.replace(/^shares\s*/, '')}`)
    .sort();
  expect(ties).toEqual([
    'Am AI Right <-> BlueLab strong',
    'Am AI Right <-> CLE (Case Law Explorer) strong',
    'BAIGLE <-> Lawnotation weak',
    'CLE (Case Law Explorer) <-> Lawnotation strong',
  ]);

  // Supply links, derived by hand from the produces/uses rows in data/registry.json.
  const supply = relations
    .filter(r => r.rel.startsWith('supplies'))
    .map(r => `${r.a} -> ${r.b}`)
    .sort();
  expect(supply).toEqual([
    'Am AI Right -> BlueLab',
    'CLE (Case Law Explorer) -> Am AI Right',
    'CLE (Case Law Explorer) -> Lawnotation',
    'Lawnotation -> BAIGLE',
  ]);
});

test('no editing, import, reset or example controls exist on any tab', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#projList .pitem')).toHaveCount(6);

  // The only interactive controls allowed: the three tab buttons, and the
  // Relations view filters (checkboxes that change what is shown, not the data).
  // Hidden modals or dialogs still count; only inactive tab views are excluded.
  const controls = () => page.locator('button, input, select, textarea, [contenteditable="true"], [onclick]')
    .evaluateAll(els => els.filter(e => !e.closest('main.view:not(.active)')).map(e => {
      const label = (e.textContent || e.getAttribute('id') || '').trim();
      return `${e.tagName.toLowerCase()}${e.getAttribute('type') ? `[${e.getAttribute('type')}]` : ''}:${label}`;
    }));
  const TABS = ['button:Projects', 'button:Relations', 'button:Catalogue'];

  for (const name of ['Am AI Right', 'Lawnotation', 'CLE (Case Law Explorer)']) {
    await page.locator('#projList .pitem', { hasText: name }).click();
    await expect(page.locator('#projDetail')).toContainText(name);
    expect(await controls()).toEqual(TABS);
  }

  await page.getByRole('button', { name: 'Relations', exact: true }).click();
  await expect(page.locator('#relBody .edgetable')).toBeVisible();
  expect(await controls()).toEqual([
    ...TABS,
    'input[checkbox]:f_weak', 'input[checkbox]:f_moderate', 'input[checkbox]:f_strong', 'input[checkbox]:f_supply',
  ]);

  await page.getByRole('button', { name: 'Catalogue', exact: true }).click();
  await expect(page.locator('#catBody .catbox')).toHaveCount(3);
  expect(await controls()).toEqual(TABS);

  await expect(page.getByText(/Load example|Import|Reset|\+ New/)).toHaveCount(0);
});
