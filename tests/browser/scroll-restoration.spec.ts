import { expect, test, type Page } from "@playwright/test";

async function waitForArchive(page: Page) {
  await page.locator('[data-year-state-bound="true"]').first().waitFor();
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  });
}

for (const reloadY of [0, 480]) {
  test(`reload preserves current scroll ${reloadY} instead of the last Back position`, async ({
    page,
  }) => {
    // Use the archive to isolate scroll saving from article code-block
    // enhancement, which changes layout after the router restores scroll.
    await page.goto("/blog/");
    await waitForArchive(page);
    await page.evaluate(() => window.scrollTo(0, 1200));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(1200);

    // DOM click avoids scrolling the header into view before navigation.
    await page
      .locator(".site-brand")
      .evaluate((link) => (link as HTMLAnchorElement).click());
    await expect(page).toHaveURL((url) => url.pathname === "/");
    await page.goBack();
    await expect(page).toHaveURL(/\/blog\/$/);
    await waitForArchive(page);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(1200);

    await page.evaluate((y) => {
      // Model a pull-to-refresh before Astro receives scrollend (or its
      // fallback scroll timer). Do not alter history state: leave the real
      // Back position stale, as it is during the reported mobile race.
      const delayScrollSave = (event: Event) =>
        event.stopImmediatePropagation();
      window.addEventListener("scroll", delayScrollSave, true);
      window.addEventListener("scrollend", delayScrollSave, true);
      window.scrollTo(0, y);
    }, reloadY);
    expect(await page.evaluate(() => window.scrollY)).toBe(reloadY);
    expect(await page.evaluate(() => history.state.scrollY)).toBe(1200);
    await page.reload();
    await waitForArchive(page);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(reloadY);

    // The saved entry must also remain correct for subsequent Forward/Back.
    await page.goForward();
    await expect(page).toHaveURL((url) => url.pathname === "/");
    await page.goBack();
    await expect(page).toHaveURL(/\/blog\/$/);
    await waitForArchive(page);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(reloadY);
  });
}
