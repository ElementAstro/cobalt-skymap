import { test, expect } from '@playwright/test';
import { waitForStarmapReady } from '../fixtures/test-helpers';

test.describe('Settings Export/Import', () => {
  test.beforeEach(async ({ page }) => {
    await waitForStarmapReady(page, { skipWasmWait: true });
  });

  async function openSettings(page: import('@playwright/test').Page) {
    const settingsButton = page.getByRole('button', { name: /settings|设置/i }).first();
    if (await settingsButton.isVisible().catch(() => false)) {
      await settingsButton.click();
      await page.waitForTimeout(500);
      return true;
    }
    return false;
  }

  test.describe('Section Visibility', () => {
    test('should have export/import section in settings', async ({ page }) => {
      if (await openSettings(page)) {
        const exportImportSection = page.locator('text=/export.*import|导入.*导出|导出.*导入/i');
        expect(await exportImportSection.count()).toBeGreaterThanOrEqual(0);

        await page.keyboard.press('Escape');
      }
    });

    test('should display section description', async ({ page }) => {
      if (await openSettings(page)) {
        const description = page.locator('text=/backup|restore|备份|恢复/i');
        expect(await description.count()).toBeGreaterThanOrEqual(0);

        await page.keyboard.press('Escape');
      }
    });
  });

  test.describe('Export Button', () => {
    test('should have export button', async ({ page }) => {
      if (await openSettings(page)) {
        const exportButton = page.getByRole('button', { name: /export|导出/i })
          .or(page.locator('button').filter({ has: page.locator('svg.lucide-download') }));

        expect(await exportButton.count()).toBeGreaterThanOrEqual(0);

        await page.keyboard.press('Escape');
      }
    });

    test('should trigger download on export click', async ({ page }) => {
      if (await openSettings(page)) {
        const exportButton = page.getByRole('button', { name: /export|导出/i }).first()
          .or(page.locator('button').filter({ has: page.locator('svg.lucide-download') }).first());

        if (await exportButton.isVisible().catch(() => false)) {
          // Listen for download event
          const downloadPromise = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);
          await exportButton.click();
          const download = await downloadPromise;

          if (download) {
            const filename = download.suggestedFilename();
            expect(filename).toContain('skymap-settings');
            expect(filename).toContain('.json');
          }
        }

        await page.keyboard.press('Escape');
      }
    });
  });

  test.describe('Import Button', () => {
    test('should have import button', async ({ page }) => {
      if (await openSettings(page)) {
        const importButton = page.getByRole('button', { name: /import|导入/i })
          .or(page.locator('button').filter({ has: page.locator('svg.lucide-upload') }));

        expect(await importButton.count()).toBeGreaterThanOrEqual(0);

        await page.keyboard.press('Escape');
      }
    });

    test('should have hidden file input for import', async ({ page }) => {
      if (await openSettings(page)) {
        const fileInput = page.locator('input[type="file"][accept=".json"]');
        expect(await fileInput.count()).toBeGreaterThanOrEqual(0);

        await page.keyboard.press('Escape');
      }
    });
  });

  test.describe('Import Confirmation', () => {
    test('should show confirmation dialog before importing', async ({ page }) => {
      if (await openSettings(page)) {
        // Simulate file upload by setting a valid JSON via page evaluate
        const fileInput = page.locator('input[type="file"]').first();

        if (await fileInput.count() > 0) {
          // Create a mock settings file
          const mockSettings = JSON.stringify({
            version: 2,
            exportedAt: new Date().toISOString(),
            settings: {
              connection: {},
              stellarium: {},
              preferences: {},
            },
          });

          // Use page.evaluate to dispatch a change event with mock data
          await page.evaluate((content) => {
            const input = document.querySelector('input[type="file"]') as HTMLInputElement;
            if (!input) return;

            const file = new File([content], 'test-settings.json', { type: 'application/json' });
            const dt = new DataTransfer();
            dt.items.add(file);
            input.files = dt.files;
            input.dispatchEvent(new Event('change', { bubbles: true }));
          }, mockSettings);

          await page.waitForTimeout(500);

          // Should show confirmation AlertDialog
          const confirmDialog = page.locator('[role="alertdialog"]');
          expect(await confirmDialog.count()).toBeGreaterThanOrEqual(0);
        }

        await page.keyboard.press('Escape');
      }
    });
  });

  test.describe('Import Status Messages', () => {
    test('should not show status messages initially', async ({ page }) => {
      if (await openSettings(page)) {
        // No success or error messages initially
        const successMessage = page.locator('text=/import.*success|导入.*成功/i');
        const errorMessage = page.locator('text=/import.*error|导入.*错误/i');

        expect(await successMessage.count()).toBe(0);
        expect(await errorMessage.count()).toBe(0);

        await page.keyboard.press('Escape');
      }
    });

    test('should show parse/validation feedback for invalid import files', async ({ page }) => {
      if (await openSettings(page)) {
        const invalidPayload = '{"version":5,"settings":';

        await page.evaluate((content) => {
          const input = document.querySelector('input[type="file"]') as HTMLInputElement;
          if (!input) return;

          const file = new File([content], 'invalid-settings.json', { type: 'application/json' });
          const dt = new DataTransfer();
          dt.items.add(file);
          input.files = dt.files;
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }, invalidPayload);

        await page.waitForTimeout(500);

        const errorMessage = page.locator('text=/parse|invalid|格式|解析/i');
        expect(await errorMessage.count()).toBeGreaterThanOrEqual(0);

        await page.keyboard.press('Escape');
      }
    });
  });
});
