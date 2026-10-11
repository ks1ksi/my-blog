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
    await page.addInitScript(() => {
      sessionStorage.setItem("test:startup-y", String(history.state?.scrollY));
    });
    // Use the archive, waiting for its fonts and disclosure layout.
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
    // A DOM swap can adjust the viewport through scroll anchoring. Capture
    // the actual Back position instead of assuming it remains exactly 1200.
    await expect
      .poll(() => page.evaluate(() => window.scrollY))
      .toBeGreaterThan(800);
    await expect
      .poll(() =>
        page.evaluate(() => Math.abs(history.state.scrollY - window.scrollY)),
      )
      .toBeLessThan(1);
    const backY = await page.evaluate(() => history.state.scrollY as number);

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
    expect(await page.evaluate(() => history.state.scrollY)).toBe(backY);
    await page.reload();
    await waitForArchive(page);
    // Verify the exact coordinate available to router startup, independently
    // of subsequent layout anchoring. Top refresh must stay exactly at top.
    expect(
      await page.evaluate(() => sessionStorage.getItem("test:startup-y")),
    ).toBe(String(reloadY));
    await expect
      .poll(() => page.evaluate((y) => Math.abs(window.scrollY - y), reloadY))
      .toBeLessThan(reloadY === 0 ? 1 : 64);
    const reloadedY = await page.evaluate(() => window.scrollY);

    // Check the entry passed to subsequent Back navigation before layout
    // anchoring can adjust the viewport again during the DOM swap.
    await page.evaluate(() => {
      window.addEventListener("popstate", (event) => {
        sessionStorage.setItem("test:traversal-y", String(event.state.scrollY));
      });
    });
    await page.goForward();
    await expect(page).toHaveURL((url) => url.pathname === "/");
    await page.goBack();
    await expect(page).toHaveURL(/\/blog\/$/);
    await waitForArchive(page);
    expect(
      await page.evaluate(() => sessionStorage.getItem("test:traversal-y")),
    ).toBe(String(reloadedY));
    await expect
      .poll(() => page.evaluate((y) => Math.abs(window.scrollY - y), reloadedY))
      .toBeLessThan(reloadedY === 0 ? 1 : 64);
  });
}
