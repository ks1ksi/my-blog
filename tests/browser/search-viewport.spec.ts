import { expect, test, type Page } from "@playwright/test";

async function openSearch(page: Page) {
  await page.locator("#magnifying-glass").click();
  const input = page.locator("#search input[type='text']");
  await expect(input).toBeFocused();
  await input.fill("OSTEP");
  await expect(page.locator(".pagefind-ui__result-link").first()).toBeVisible();
  return input;
}

async function expectControlsInside(page: Page, top: number, bottom: number) {
  for (const selector of ["#search-close", "#search input[type='text']"]) {
    const bounds = await page.locator(selector).boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.y).toBeGreaterThanOrEqual(top);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(bottom);
  }
}

async function expectScrollableResults(page: Page) {
  const input = page.locator("#search input[type='text']");
  const before = await input.boundingBox();
  const drawer = page.locator("#search .pagefind-ui__drawer");
  await expect
    .poll(() =>
      drawer.evaluate((node) => node.scrollHeight > node.clientHeight),
    )
    .toBe(true);
  await drawer.evaluate((node) => (node.scrollTop = 100));
  expect(await drawer.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
  expect(await input.boundingBox()).toEqual(before);
  expect(
    await page.locator("#search-dialog").evaluate((node) => node.scrollTop),
  ).toBe(0);
}

test.beforeEach(async ({ page }) => {
  await page.route("https://giscus.app/**", (route) => route.abort());
});

for (const viewport of [
  { width: 320, height: 568 },
  { width: 390, height: 300 },
]) {
  test(`search stays above results at ${viewport.width}×${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await openSearch(page);
    const bounds = await page.locator("#search-dialog").boundingBox();
    expect(bounds!.y).toBeGreaterThanOrEqual(16);
    expect(bounds!.y).toBeLessThanOrEqual(32);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(
      viewport.height - 15,
    );
    await expectControlsInside(page, 16, viewport.height - 16);
    await expectScrollableResults(page);
    await page.locator("#search-close").click();
    await expect(page.locator("#search-dialog")).not.toBeVisible();
    await expect(page.locator("#magnifying-glass")).toBeFocused();
  });
}

test("search follows a resized/panned visual viewport and cleans up on navigation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  // Headless engines do not open a physical phone keyboard. Simulate its
  // visual-viewport events while deliberately keeping the layout viewport tall.
  await page.addInitScript(() => {
    const viewport = Object.assign(new EventTarget(), {
      height: 844,
      offsetTop: 0,
      width: 390,
      offsetLeft: 0,
      scale: 1,
    });
    Object.defineProperty(window, "visualViewport", { value: viewport });
  });
  await page.goto("/");
  await openSearch(page);
  await page.evaluate(() => {
    Object.assign(window.visualViewport!, { height: 300, offsetTop: 120 });
    window.visualViewport!.dispatchEvent(new Event("resize"));
  });
  await expect(page.locator("#search-dialog")).toHaveCSS("top", "136px");
  await expectControlsInside(page, 136, 404);
  await expectScrollableResults(page);
  await page.evaluate(() => {
    Object.assign(window.visualViewport!, { offsetTop: 160 });
    window.visualViewport!.dispatchEvent(new Event("scroll"));
  });
  await expect(page.locator("#search-dialog")).toHaveCSS("top", "176px");
  await expectControlsInside(page, 176, 444);
  await page.locator("#search-close").click();
  await expect(page.locator("#magnifying-glass")).toBeFocused();
  await page.evaluate(() => {
    Object.assign(window.visualViewport!, { height: 844, offsetTop: 0 });
    window.visualViewport!.dispatchEvent(new Event("resize"));
  });
  expect(
    await page.locator("#search-dialog").evaluate((node) => node.style.cssText),
  ).toBe("");

  await openSearch(page);
  await page.locator(".pagefind-ui__result-link").first().click();
  await expect(page).toHaveURL(/\/blog\/[^/]+\/$/);
  await expect(page.locator("#search-dialog")).not.toBeVisible();
  expect(
    await page.locator("#search-dialog").evaluate((node) => node.style.cssText),
  ).toBe("");
  await openSearch(page);
  await page.evaluate(() => {
    Object.assign(window.visualViewport!, { height: 280, offsetTop: 60 });
    window.visualViewport!.dispatchEvent(new Event("resize"));
  });
  await expect(page.locator("#search-dialog")).toHaveCSS("top", "76px");
  await expectControlsInside(page, 76, 324);
  await page.locator("#search-close").click();
  await expect(page.locator("#magnifying-glass")).toBeFocused();
});

test("search has a constrained CSS fallback without VisualViewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 320 });
  await page.addInitScript(() => {
    Object.defineProperty(window, "visualViewport", { value: undefined });
  });
  await page.goto("/");
  await openSearch(page);
  await expectControlsInside(page, 16, 304);
  await expectScrollableResults(page);
});

test("desktop search keeps its centered layout", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await openSearch(page);
  const bounds = await page.locator("#search-dialog").boundingBox();
  expect(bounds).not.toBeNull();
  expect(Math.abs(bounds!.y + bounds!.height / 2 - 450)).toBeLessThan(2);
  expect(bounds!.width).toBeLessThanOrEqual(640);
});
