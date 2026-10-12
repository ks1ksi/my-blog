import { expect, test } from "@playwright/test";

type HeaderFrame = { y: number; height: number; opacity: number };
declare global {
  interface Window {
    __headerFrames?: HeaderFrame[];
    __headerDone?: boolean;
  }
}

test.use({ reducedMotion: "no-preference" });

for (const colorScheme of ["light", "dark"] as const) {
  test(`sticky header stays opaque during scrolled article navigation (${colorScheme})`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme });
    await page.goto("/blog/");
    test.skip(
      !(await page.evaluate(() => Boolean(document.startViewTransition))),
      "Native snapshot isolation requires View Transitions support",
    );
    await page.locator('[data-year-state-bound="true"]').first().waitFor();
    await page.evaluate(async () => {
      await document.fonts.ready;
      window.scrollTo(0, 1200);
    });
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(1200);
    const header = await page.locator(".site-header").boundingBox();
    const index = await page.locator("main h3 a").evaluateAll((links) =>
      links.findIndex((link) => {
        const rect = link.getBoundingClientRect();
        return rect.top > 100 && rect.bottom < innerHeight - 20;
      }),
    );
    expect(index).toBeGreaterThanOrEqual(0);
    const article = page.locator("main h3 a").nth(index);
    const path = new URL((await article.getAttribute("href"))!, page.url())
      .pathname;
    await page.evaluate(() => {
      document.addEventListener(
        "astro:before-swap",
        (event) => {
          const frames: HeaderFrame[] = [];
          window.__headerFrames = frames;
          window.__headerDone = false;
          // Inspect the actual snapshot that contains the header. Looking only
          // at the live element's opacity misses root snapshot crossfades.
          event.viewTransition.ready.then(() => {
            let remaining = 20;
            const sample = () => {
              const header =
                document.querySelector<HTMLElement>(".site-header")!;
              let owner: HTMLElement | null = header;
              let name = "none";
              while (owner) {
                name = getComputedStyle(owner).viewTransitionName;
                if (name !== "none") break;
                owner = owner.parentElement;
              }
              const rect = header.getBoundingClientRect();
              frames.push({
                y: rect.y,
                height: rect.height,
                opacity: Number(
                  getComputedStyle(
                    document.documentElement,
                    `::view-transition-new(${name})`,
                  ).opacity,
                ),
              });
              if (--remaining) requestAnimationFrame(sample);
              else window.__headerDone = true;
            };
            requestAnimationFrame(sample);
          });
        },
        { once: true },
      );
    });
    await article.click();
    await expect(page).toHaveURL((url) => url.pathname === path);
    await expect
      .poll(() => page.evaluate(() => window.__headerDone))
      .toBe(true);
    const frames = await page.evaluate(() => window.__headerFrames!);
    expect(frames).toHaveLength(20);
    for (const frame of frames) {
      expect(frame.opacity, JSON.stringify(frames)).toBe(1);
      expect(Math.abs(frame.y - header!.y)).toBeLessThanOrEqual(1);
      expect(Math.abs(frame.height - header!.height)).toBeLessThanOrEqual(1);
    }
    // The header is still replaced normally so route and theme controls update.
    await expect(page.locator('.primary-nav a[href="/blog/"]')).toHaveAttribute(
      "aria-current",
      "location",
    );
    await page.locator(".site-brand").click();
    await expect(page).toHaveURL((url) => url.pathname === "/");
    await expect(
      page.locator('.primary-nav a[href="/blog/"]'),
    ).not.toHaveAttribute("aria-current");
    await page.getByRole("button", { name: "검색", exact: true }).click();
    await expect(page.locator("#search-dialog")).toBeVisible();
  });
}
