import { test, expect, type Page } from '@playwright/test';

// Hand-written registry exercising cases the 6 real projects don't (eng review F3):
//  - a `research`-type project
//  - a "uses" row whose src points at a produces row that no longer exists (dangling source)
//  - a pair whose only tie is weak (shared component, no shared data)
// plus a description carrying markup, as later harvested README text may.
const HOSTILE = '<script>window.__xss="script"</script><img src=x onerror="window.__xss=\'img\'">';

const FIXTURE = {
  dataSources: [{ id: 'ds', name: 'Case law', subs: [{ id: 'ds_x', name: 'NL' }, { id: 'ds_y', name: 'EU' }] }],
  techniques: [{ id: 't_bert', name: 'BERT' }],
  components: [
    { id: 'c_search', name: 'Search', subs: [{ id: 'c_search_kw', name: 'Keyword' }] },
    { id: 'c_seg', name: 'Segmentation', subs: [] },
  ],
  current: 'p_lab',
  projects: [
    {
      id: 'p_lab', name: 'Research Lab', type: 'research', description: HOSTILE,
      uses: [{ id: 'r_lab_u', comp: 'c_search_kw', datas: [], techs: [] }],
      produces: [{ id: 'r_lab_p', comp: 'c_seg', datas: ['ds_x'], techs: ['t_bert'] }],
    },
    {
      id: 'p_partner', name: 'Weak Partner', type: 'software',
      uses: [
        { id: 'r_partner_u', comp: 'c_search_kw', datas: ['ds_y'], techs: ['t_bert'] },
        { id: 'r_partner_src', src: { proj: 'p_lab', row: 'r_lab_p' } },
      ],
      produces: [],
    },
    {
      id: 'p_orphan', name: 'Orphan Consumer', type: 'software',
      uses: [{ id: 'r_orphan_src', src: { proj: 'p_lab', row: 'r_deleted' } }],
      produces: [],
    },
  ],
};

async function openWithFixture(page: Page, errors: string[]) {
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/data/registry.json', route => route.fulfill({ json: FIXTURE }));
  await page.goto('/');
  await expect(page.locator('#projList .pitem .nm')).toHaveText(['Research Lab', 'Weak Partner', 'Orphan Consumer']);
}

test('a project description containing markup renders as text and never executes', async ({ page }) => {
  const errors: string[] = [];
  await openWithFixture(page, errors);
  await page.locator('#projList .pitem', { hasText: 'Research Lab' }).click();
  await expect(page.locator('#projDetail')).toContainText(HOSTILE);
  await expect(page.locator('#projDetail script, #projDetail img')).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).__xss)).toBeUndefined();
  expect(errors).toEqual([]);
});

test('edge fixtures render without errors and with the expected relations', async ({ page }) => {
  const errors: string[] = [];
  await openWithFixture(page, errors);

  // research-type project is labelled as such
  await page.locator('#projList .pitem', { hasText: 'Research Lab' }).click();
  await expect(page.locator('#projDetail .pill')).toHaveText('Research');

  // dangling source: the row is shown as removed rather than breaking the page
  await page.locator('#projList .pitem', { hasText: 'Orphan Consumer' }).click();
  await expect(page.locator('#projDetail')).toContainText('(removed)');

  await page.getByRole('button', { name: 'Relations', exact: true }).click();
  const rows = page.locator('#relBody .edgetable tbody tr');
  await expect(rows.first()).toBeVisible();
  const relations = await rows.evaluateAll(trs => trs.map(tr =>
    [...tr.querySelectorAll('td')].slice(0, 3).map(td => td.textContent!.trim()).join(' | ')));
  // Only the weak tie (shared Search – Keyword, no shared data) and the one live supply link;
  // the dangling row contributes nothing.
  expect(relations.sort()).toEqual([
    'Research Lab | shares weak | Weak Partner',
    'Research Lab | supplies ▶ | Weak Partner',
  ]);

  await page.getByRole('button', { name: 'Catalogue', exact: true }).click();
  await expect(page.locator('#catBody .catbox')).toHaveCount(3);
  expect(errors).toEqual([]);
});
