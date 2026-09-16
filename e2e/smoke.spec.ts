import { expect, test } from '@playwright/test';

// A small public repository whose dependencies are unlikely to all be current.
const REPOSITORY = 'sindresorhus/is-plain-obj';

test('checks a repository and shows its dependency report', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Package Validator' })).toBeVisible();

  await page.getByLabel('Repository').fill(REPOSITORY);
  await expect(page.getByText('Public repository found.')).toBeVisible();

  await page.getByLabel('Email').fill('smoke@example.com');
  await page.getByRole('button', { name: 'Analyze dependencies' }).click();

  const report = page.getByRole('region', { name: REPOSITORY });
  await expect(report).toBeVisible();
  await expect(report.getByText(/outdated dependenc|up to date/)).toBeVisible();
  await expect(report.getByText(/Checked against the npm registry/)).toBeVisible();
});

test('serves the OpenAPI document through the same origin', async ({ request }) => {
  const response = await request.get('/docs/openapi.json');

  expect(response.ok()).toBe(true);
  expect(Object.keys((await response.json()).paths)).toContain('/v1/subscriptions');
});
