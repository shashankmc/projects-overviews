import { test, expect, type Page } from '@playwright/test';

// Rows of a Catalogue box as "Parent – Name: count" (subs) or "Name: count" (top level).
async function usageRows(page: Page, box: string) {
  return page.locator(`${box} .citem`).evaluateAll(els => {
    let parent = '';
    return els.flatMap(e => {
      const nm = e.querySelector('.nm')!.textContent!.trim();
      const use = e.querySelector('.use')?.textContent?.trim();
      if (!e.classList.contains('sub')) parent = nm;
      if (use === undefined) return [];
      return [`${e.classList.contains('sub') ? `${parent} – ${nm}` : nm}: ${use}`];
    });
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Catalogue', exact: true }).click();
});

test('Catalogue counts how many projects use each data source', async ({ page }) => {
  // Hand-counted from data/registry.json (spec decision D3).
  expect(await usageRows(page, '#catData')).toEqual([
    'Legislation – EU: 3 use(s)',
    'Legislation – NL: 2 use(s)',
    'Legislation – ECHR: 1 use(s)',
    'Case law – NL: 3 use(s)',
    'Case law – CJEU: 2 use(s)',
    'Case law – ECtHR: 2 use(s)',
    'Problem descriptions – NL: 1 use(s)',
  ]);
});

test('Catalogue technique and component counts match the prototype', async ({ page }) => {
  // Recorded from the prototype's output on the same data.
  expect(await usageRows(page, '#catTech')).toEqual([
    'RAG: 0 use(s)',
    'BERT: 1 use(s)',
    'TF-IDF: 1 use(s)',
    'LLM: 1 use(s)',
    'Semantic (cosine) similarity: 1 use(s)',
    'Citation / network analysis: 1 use(s)',
    'AI Agents: 2 use(s)',
    'API: 3 use(s)',
    'Cytoscape: 1 use(s)',
  ]);
  expect(await usageRows(page, '#catComp')).toEqual([
    'Data ingestion / import: 0 proj',
    'Search: 3 proj',
    'Search – Keyword: 1',
    'Search – Semantic: 1',
    'Search – Query enhancement: 1',
    'Search – Extractors: 2',
    'Search – Query generation: 1',
    'Search – Retrieval augmentation: 1',
    'Preprocessing: 2 proj',
    'Preprocessing – Segmentation: 1',
    'Preprocessing – Preconditions/Postconditions: 2',
    'Preprocessing – Deontic modalities: 1',
    'Annotation: 2 proj',
    'Annotation – Manual annotation: 1',
    'Annotation – Scheme / label-set management: 1',
    'Annotation – Pre-annotation (AI-assisted): 1',
    'Annotation – Annotator assignment / task distribution: 1',
    'Annotation – IRR: 1',
    'Annotation – Export/publish: 2',
    'Citation / network analysis: 2 proj',
    'Citation / network analysis – Citation extraction / parsing: 2',
    'Citation / network analysis – Centrality scores: 1',
    'Citation / network analysis – Community detection: 1',
    'Citation / network analysis – Network visualization: 1',
    'Filtering / faceting: 0 proj',
    'Draft: 0 proj',
    'Export / publish: 1 proj',
    'Authorization: 0 proj',
    'Project management: 0 proj',
  ]);
});
