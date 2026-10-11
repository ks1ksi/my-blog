import { expect, test } from "@playwright/test";

const ARTICLE = "/blog/ostep-33-event-based-concurrency/";

for (const reloadY of [0, 480]) {
  test(`reload preserves current scroll ${reloadY} instead of the last Back position`, async ({
    page,
  }) => {
    await page.route("https://giscus.app/**", (route) => route.abort());
    await page.goto(ARTICLE);
    await page.waitForFunction(() => Boolean(history.state));
    await page.evaluate(() => window.scrollTo(0, 1200));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(1200);

    // DOM click avoids scrolling the header into view before navigation.
    await page
      .locator('a[href="/blog/"]')
      .first()
      .evaluate((link) => (link as HTMLAnchorElement).click());
    await expect(page).toHaveURL(/\/blog\/$/);
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`${ARTICLE}$`));
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
    await page.waitForFunction(() => document.querySelector(".copy-code"));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(reloadY);

    // The saved entry must also remain correct for subsequent Forward/Back.
    await page.goForward();
    await expect(page).toHaveURL(/\/blog\/$/);
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`${ARTICLE}$`));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(reloadY);
  });
}
