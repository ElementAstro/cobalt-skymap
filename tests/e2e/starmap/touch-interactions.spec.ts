import { test, expect, type Locator } from '@playwright/test';
import { StarmapPage } from '../fixtures/page-objects';
import {
  waitForStarmapReady,
  expectInViewport,
  expectMinimumTouchTarget,
} from '../fixtures/test-helpers';
import { VIEWPORT_SIZES } from '../fixtures/test-data';

async function clickElement(locator: Locator) {
  await locator.evaluate((element) => {
    (element as HTMLButtonElement).click();
  });
}

test.describe('Touch Interactions', () => {
  let starmapPage: StarmapPage;

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(VIEWPORT_SIZES.mobile);
    starmapPage = new StarmapPage(page);
    await waitForStarmapReady(page, { skipWasmWait: true });
  });

  test('keeps canvas interactive after pan gesture', async ({ page }) => {
    const box = await starmapPage.canvas.boundingBox();
    expect(box).not.toBeNull();

    const startX = box!.x + box!.width / 2;
    const startY = box!.y + box!.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 120, startY + 40, { steps: 10 });
    await page.mouse.up();

    await expect(starmapPage.canvas).toBeVisible();
    await expect(page.locator('[role="menu"]')).toHaveCount(0);
  });

  test('keeps canvas stable across zoom wheel gestures', async ({ page }) => {
    const box = await starmapPage.canvas.boundingBox();
    expect(box).not.toBeNull();

    const centerX = box!.x + box!.width / 2;
    const centerY = box!.y + box!.height / 2;
    await page.mouse.move(centerX, centerY);
    await page.mouse.wheel(0, -120);
    await page.mouse.wheel(0, 120);

    await expect(starmapPage.canvas).toBeVisible();
    await expect(page.locator('[role="menu"]')).toHaveCount(0);
  });

  test('mobile rail controls stay touch-sized and in viewport', async ({ page }) => {
    const searchRailButton = page.getByTestId('mobile-rail-search');
    const planningRailButton = page.getByTestId('mobile-rail-planning');
    const settingsRailButton = page.getByTestId('mobile-rail-settings');

    await expectMinimumTouchTarget(searchRailButton, 'mobile search rail button', 44);
    await expectMinimumTouchTarget(planningRailButton, 'mobile planning rail button', 44);
    await expectMinimumTouchTarget(settingsRailButton, 'mobile settings rail button', 44);

    await expectInViewport(page, page.getByTestId('mobile-action-rail'), 'mobile action rail');
    await expectInViewport(page, page.getByTestId('mobile-bottom-tools-bar'), 'mobile bottom tools bar');
    await expectInViewport(page, page.getByTestId('mobile-zoom-cluster'), 'mobile zoom cluster');
  });

  test('touching search rail does not trigger map context menu', async ({ page }) => {
    const searchRailButton = page.getByTestId('mobile-rail-search');
    await clickElement(searchRailButton);

    await expect(searchRailButton).toHaveAttribute('data-variant', 'default');
    await expect(page.locator('[role="menu"]')).toHaveCount(0);
    await expect(
      page.locator('[data-slot="drawer-content"]').filter({ hasText: /search|搜索/i }).first(),
    ).toBeVisible();
  });

  test('scrolling search drawer keeps search panel active', async ({ page }) => {
    const searchRailButton = page.getByTestId('mobile-rail-search');
    await clickElement(searchRailButton);

    const searchDrawer = page
      .locator('[data-slot="drawer-content"]')
      .filter({ hasText: /search|搜索/i })
      .first();

    await expect(searchDrawer).toBeVisible();
    const canvasBefore = await starmapPage.canvas.boundingBox();
    expect(canvasBefore).not.toBeNull();

    await searchDrawer.hover();
    await page.mouse.wheel(0, 220);
    await page.mouse.wheel(0, -120);

    await expect(searchRailButton).toHaveAttribute('data-variant', 'default');
    const canvasAfter = await starmapPage.canvas.boundingBox();
    expect(canvasAfter).not.toBeNull();
    expect(canvasAfter!.width).toBeCloseTo(canvasBefore!.width, 1);
    expect(canvasAfter!.height).toBeCloseTo(canvasBefore!.height, 1);
    await expect(page.locator('[role="menu"]')).toHaveCount(0);
  });

  test('tablet viewport still keeps mobile controls reachable', async ({ page }) => {
    await page.setViewportSize(VIEWPORT_SIZES.tablet);
    await waitForStarmapReady(page, { skipWasmWait: true });

    const searchEntry = page.getByTestId('mobile-rail-search')
      .or(page.locator('[data-tour-id="search-button"]').first())
      .first();
    const settingsEntry = page.getByTestId('mobile-rail-settings')
      .or(page.getByTestId('settings-button'))
      .first();

    await expect(searchEntry).toBeVisible();
    await expect(settingsEntry).toBeVisible();
    await expectInViewport(page, searchEntry, 'tablet search entry');
    await expectInViewport(page, settingsEntry, 'tablet settings entry');
  });
});
