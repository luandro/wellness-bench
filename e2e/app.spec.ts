import { test, expect } from '@playwright/test';

test.describe('App Rendering', () => {
  test('should render without errors', async ({ page }) => {
    // Collect all errors
    const consoleErrors: string[] = [];
    const pageErrors: Error[] = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    await page.goto('/');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // Check that page loads successfully
    const title = await page.title();
    expect(title).toBeTruthy();

    // Wait for React app to mount - check for root div
    await expect(page.locator('#root')).toBeAttached();

    // Verify no page errors (these are actual JS errors)
    expect(pageErrors).toHaveLength(0);

    // Verify no critical console errors
    const criticalErrors = consoleErrors.filter(e =>
      !e.includes('DevTools') &&
      !e.includes('HMR') &&
      !e.includes('Extension')
    );

    expect(criticalErrors).toHaveLength(0);
  });

  test('should render content', async ({ page }) => {
    await page.goto('/');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // Wait for React root to be attached
    await expect(page.locator('#root')).toBeAttached();

    // Check that root element has content
    const root = page.locator('#root');
    const rootText = await root.textContent();
    expect(rootText?.trim().length).toBeGreaterThan(0);
  });
});
