import { test, expect, type Locator } from '@playwright/test';
import { waitForStarmapReady } from '../fixtures/test-helpers';

async function clickRailButton(forceLocator: Locator) {
  await forceLocator.evaluate((element) => {
    (element as HTMLButtonElement).click();
  });
}

test.describe('Mobile Functional Parity', () => {
  test('supports search -> details -> planning -> settings flow on mobile shell', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await waitForStarmapReady(page, { skipWasmWait: true });

    const searchRailButton = page.getByTestId('mobile-rail-search');
    const detailRailButton = page.getByTestId('mobile-rail-details');
    const planningRailButton = page.getByTestId('mobile-rail-planning');
    const settingsRailButton = page.getByTestId('mobile-rail-settings');

    await expect(searchRailButton).toBeVisible();
    await expect(detailRailButton).toBeVisible();
    await expect(planningRailButton).toBeVisible();
    await expect(settingsRailButton).toBeVisible();

    await clickRailButton(searchRailButton);
    await expect(searchRailButton).toHaveAttribute('data-variant', 'default');
    await page.keyboard.press('Escape');
    await expect(searchRailButton).toHaveAttribute('data-variant', 'ghost');

    await clickRailButton(planningRailButton);
    await expect(planningRailButton).toBeVisible();
    await expect(planningRailButton).toHaveAttribute('data-variant', 'default');
    await expect(
      page.locator('[role="dialog"]').filter({ hasText: /session planner|观测计划|session/i }).first(),
    ).toBeVisible();
    await page.keyboard.press('Escape');

    await clickRailButton(settingsRailButton);
    await expect(settingsRailButton).toHaveAttribute('data-variant', 'default');
    await expect(page.getByTestId('settings-panel').first()).toBeVisible();
  });

  test('allows transition from search overlay to planning panel on mobile shell', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await waitForStarmapReady(page, { skipWasmWait: true });

    const searchRailButton = page.getByTestId('mobile-rail-search');
    const planningRailButton = page.getByTestId('mobile-rail-planning');

    await clickRailButton(searchRailButton);
    await expect(searchRailButton).toHaveAttribute('data-variant', 'default');
    await page.keyboard.press('Escape');
    await expect(searchRailButton).toHaveAttribute('data-variant', 'ghost');

    await clickRailButton(planningRailButton);
    await expect(planningRailButton).toBeVisible();
    await expect(planningRailButton).toHaveAttribute('data-variant', 'default');
    await expect(
      page.locator('[role="dialog"]').filter({ hasText: /session planner|观测计划|session/i }).first(),
    ).toBeVisible();
  });

  test('keeps core mobile rail actions reachable on narrow viewport and orientation changes', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await waitForStarmapReady(page, { skipWasmWait: true });

    const railButtons = [
      page.getByTestId('mobile-rail-search'),
      page.getByTestId('mobile-rail-details'),
      page.getByTestId('mobile-rail-planning'),
      page.getByTestId('mobile-rail-settings'),
    ];

    for (const button of railButtons) {
      await expect(button).toBeVisible();
      const box = await button.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(320);
    }

    await page.setViewportSize({ width: 812, height: 375 });

    const landscapeSearchEntry = page.getByTestId('mobile-rail-search').or(page.locator('[data-tour-id="search-button"]').first()).first();
    const landscapePlanningEntry = page.getByTestId('mobile-rail-planning').or(page.locator('[data-tour-id="session-planner"]').first()).first();
    const landscapeSettingsEntry = page.getByTestId('mobile-rail-settings').or(page.getByTestId('settings-button')).first();

    await expect(landscapeSearchEntry).toBeVisible();
    await expect(landscapePlanningEntry).toBeVisible();
    await expect(landscapeSettingsEntry).toBeVisible();
  });

  test('shows actionable fallback when sensor permission is denied in AR flow', async ({ page }) => {
    await page.addInitScript(() => {
      class MockDeviceOrientationEvent extends Event {
        static async requestPermission() {
          return 'denied' as const;
        }
      }
      Object.defineProperty(window, 'DeviceOrientationEvent', {
        configurable: true,
        writable: true,
        value: MockDeviceOrientationEvent,
      });
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await waitForStarmapReady(page, { skipWasmWait: true });

    const arToggle = page.getByTestId('ar-mode-toggle').first();
    await expect(arToggle).toBeVisible();
    await arToggle.click();

    await expect(page.getByText(/Use Sensor Control to grant or retry orientation permission\./i)).toBeVisible();
  });

  test('shows calibration-required fallback when AR sensor is available and uncalibrated', async ({ page }) => {
    await page.addInitScript(() => {
      class MockDeviceOrientationEvent extends Event {
        // Intentionally omit requestPermission to simulate environments
        // where orientation access is already allowed.
      }
      Object.defineProperty(window, 'DeviceOrientationEvent', {
        configurable: true,
        writable: true,
        value: MockDeviceOrientationEvent,
      });
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await waitForStarmapReady(page, { skipWasmWait: true });

    const arToggle = page.getByTestId('ar-mode-toggle').first();
    await expect(arToggle).toBeVisible();
    await arToggle.click();

    await expect(page.getByText(/Calibrate sensor from Sensor Control to improve pointing\./i)).toBeVisible();
  });
});
