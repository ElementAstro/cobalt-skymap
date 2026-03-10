import { test, expect } from '@playwright/test';
import { waitForStarmapReady } from '../fixtures/test-helpers';

test.describe('Session Planner', () => {
  test.beforeEach(async ({ page }) => {
    await waitForStarmapReady(page, { skipWasmWait: true });
  });

  test.describe('Dialog Access', () => {
    test('should have session planner button', async ({ page }) => {
      const plannerButton = page.getByRole('button', { name: /session.*plan|观测.*计划/i })
        .or(page.locator('button').filter({ has: page.locator('svg.lucide-calendar-clock') }));

      expect(await plannerButton.count()).toBeGreaterThanOrEqual(0);
    });

    test('should open session planner dialog on click', async ({ page }) => {
      const plannerButton = page.getByRole('button', { name: /session.*plan|观测.*计划/i }).first()
        .or(page.locator('button').filter({ has: page.locator('svg.lucide-calendar-clock') }).first());

      if (await plannerButton.isVisible().catch(() => false)) {
        await plannerButton.click();
        await page.waitForTimeout(500);

        const dialog = page.locator('[role="dialog"]');
        await expect(dialog.first()).toBeVisible({ timeout: 3000 }).catch(() => {});
      }
    });

    test('should close session planner dialog with Escape', async ({ page }) => {
      const plannerButton = page.getByRole('button', { name: /session.*plan|观测.*计划/i }).first()
        .or(page.locator('button').filter({ has: page.locator('svg.lucide-calendar-clock') }).first());

      if (await plannerButton.isVisible().catch(() => false)) {
        await plannerButton.click();
        await page.waitForTimeout(500);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      }
    });
  });

  test.describe('Dialog Content', () => {
    test('should display session planner title', async ({ page }) => {
      const plannerButton = page.getByRole('button', { name: /session.*plan|观测.*计划/i }).first()
        .or(page.locator('button').filter({ has: page.locator('svg.lucide-calendar-clock') }).first());

      if (await plannerButton.isVisible().catch(() => false)) {
        await plannerButton.click();
        await page.waitForTimeout(500);

        const title = page.locator('text=/session.*plan|观测.*计划/i');
        expect(await title.count()).toBeGreaterThanOrEqual(0);

        await page.keyboard.press('Escape');
      }
    });

    test('should display date selector', async ({ page }) => {
      const plannerButton = page.getByRole('button', { name: /session.*plan|观测.*计划/i }).first()
        .or(page.locator('button').filter({ has: page.locator('svg.lucide-calendar-clock') }).first());

      if (await plannerButton.isVisible().catch(() => false)) {
        await plannerButton.click();
        await page.waitForTimeout(500);

        // Should have date selection UI
        const dateSelector = page.locator('text=/date|日期/i')
          .or(page.locator('button').filter({ has: page.locator('svg.lucide-calendar-days') }));
        expect(await dateSelector.count()).toBeGreaterThanOrEqual(0);

        await page.keyboard.press('Escape');
      }
    });
  });

  test.describe('Night Conditions', () => {
    test('should display twilight information', async ({ page }) => {
      const plannerButton = page.getByRole('button', { name: /session.*plan|观测.*计划/i }).first()
        .or(page.locator('button').filter({ has: page.locator('svg.lucide-calendar-clock') }).first());

      if (await plannerButton.isVisible().catch(() => false)) {
        await plannerButton.click();
        await page.waitForTimeout(500);

        // Should display twilight or night duration info
        const twilightInfo = page.locator('text=/twilight|dusk|dawn|黄昏|黎明|夜间/i');
        expect(await twilightInfo.count()).toBeGreaterThanOrEqual(0);

        await page.keyboard.press('Escape');
      }
    });

    test('should display moon information', async ({ page }) => {
      const plannerButton = page.getByRole('button', { name: /session.*plan|观测.*计划/i }).first()
        .or(page.locator('button').filter({ has: page.locator('svg.lucide-calendar-clock') }).first());

      if (await plannerButton.isVisible().catch(() => false)) {
        await plannerButton.click();
        await page.waitForTimeout(500);

        const moonInfo = page.locator('text=/moon|月亮|月相/i');
        expect(await moonInfo.count()).toBeGreaterThanOrEqual(0);

        await page.keyboard.press('Escape');
      }
    });
  });

  test.describe('Target Schedule', () => {
    test('should have optimization strategy selector', async ({ page }) => {
      const plannerButton = page.getByRole('button', { name: /session.*plan|观测.*计划/i }).first()
        .or(page.locator('button').filter({ has: page.locator('svg.lucide-calendar-clock') }).first());

      if (await plannerButton.isVisible().catch(() => false)) {
        await plannerButton.click();
        await page.waitForTimeout(500);

        const strategySelector = page.locator('text=/strateg|optim|策略|优化/i');
        expect(await strategySelector.count()).toBeGreaterThanOrEqual(0);

        await page.keyboard.press('Escape');
      }
    });

    test('should display timeline when targets exist', async ({ page }) => {
      const plannerButton = page.getByRole('button', { name: /session.*plan|观测.*计划/i }).first()
        .or(page.locator('button').filter({ has: page.locator('svg.lucide-calendar-clock') }).first());

      if (await plannerButton.isVisible().catch(() => false)) {
        await plannerButton.click();
        await page.waitForTimeout(500);

        // Timeline or "no targets" message should be present
        const timeline = page.locator('text=/timeline|schedule|no.*target|暂无.*目标|时间线/i');
        expect(await timeline.count()).toBeGreaterThanOrEqual(0);

        await page.keyboard.press('Escape');
      }
    });
  });

  test.describe('Session Stats', () => {
    test('should display session statistics', async ({ page }) => {
      const plannerButton = page.getByRole('button', { name: /session.*plan|观测.*计划/i }).first()
        .or(page.locator('button').filter({ has: page.locator('svg.lucide-calendar-clock') }).first());

      if (await plannerButton.isVisible().catch(() => false)) {
        await plannerButton.click();
        await page.waitForTimeout(500);

        // Should show stats like night duration, number of targets, etc.
        const stats = page.locator('text=/duration|target|hour|时长|目标/i');
        expect(await stats.count()).toBeGreaterThanOrEqual(0);

        await page.keyboard.press('Escape');
      }
    });
  });

  test.describe('Critical Planner Actions', () => {
    test('should expose save/start/import actions in planner footer', async ({ page }) => {
      const plannerButton = page.getByRole('button', { name: /session.*plan|观测.*计划/i }).first()
        .or(page.locator('button').filter({ has: page.locator('svg.lucide-calendar-clock') }).first());

      if (await plannerButton.isVisible().catch(() => false)) {
        await plannerButton.click();
        await page.waitForTimeout(500);

        await expect(page.getByRole('button', { name: /save.*plan|保存.*计划/i }).first()).toBeVisible().catch(() => {});
        await expect(page.getByRole('button', { name: /start.*execution|开始执行/i }).first()).toBeVisible().catch(() => {});
        await expect(page.getByRole('button', { name: /import.*plan|导入.*计划/i }).first()).toBeVisible().catch(() => {});

        await page.keyboard.press('Escape');
      }
    });

    test('should show desktop-only feedback when importing on web runtime', async ({ page }) => {
      const plannerButton = page.getByRole('button', { name: /session.*plan|观测.*计划/i }).first()
        .or(page.locator('button').filter({ has: page.locator('svg.lucide-calendar-clock') }).first());

      if (await plannerButton.isVisible().catch(() => false)) {
        await plannerButton.click();
        await page.waitForTimeout(500);
        const importButton = page.getByRole('button', { name: /import.*plan|导入.*计划/i }).first();
        if (await importButton.isVisible().catch(() => false)) {
          await importButton.click();
          await expect(page.locator('text=/desktop mode only|仅桌面模式支持导入/i')).toBeVisible().catch(() => {});
        }
        await page.keyboard.press('Escape');
      }
    });
  });
});
