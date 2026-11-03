import { test, expect } from '@playwright/test';

// The page must degrade to a clear message, never a blank page, when the registry data is unusable.
const DATA = '**/data/registry.json';

test('registry data returning 404 shows "Data unavailable"', async ({ page }) => {
  await page.route(DATA, route => route.fulfill({ status: 404, body: 'Not Found' }));
  await page.goto('/');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('Data unavailable');
});

test('registry data with invalid JSON shows "Data unavailable"', async ({ page }) => {
  await page.route(DATA, route => route.fulfill({ status: 200, contentType: 'application/json', body: '{"projects": [ {"id": ' }));
  await page.goto('/');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('Data unavailable');
});

test('registry data that is valid JSON but not a registry shows "Data unavailable"', async ({ page }) => {
  await page.route(DATA, route => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.goto('/');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('Data unavailable');
});
