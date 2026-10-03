import { expect, test, type Page, type TestInfo } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const ARTICLE = "/blog/ostep-33-event-based-concurrency/";
const SEARCH_STYLES = /\/_astro\/ui\.[^/]+\.css(?:\?.*)?$/;

async function openSearch(page: Page, query?: string) {
  await page.locator("#magnifying-glass").click();
  await expect(page.locator("#search-dialog")).toBeVisible();
  const input = page.locator("#search input[type='text']");
  await expect(input).toBeFocused();
  if (query) {
    await input.fill(query);
    await expect(
      page.locator(".pagefind-ui__result-link").first(),
    ).toBeVisible();
  }
  return input;
}

async function assertSearchStyles(page: Page) {
  await expect
    .poll(() =>
      page
        .locator("#pagefind-ui-styles")
        .evaluate(
          (node) =>
            node instanceof HTMLLinkElement &&
            node.isConnected &&
            Boolean(node.sheet),
        ),
    )
    .toBe(true);
  await expect(page.locator("#pagefind-ui-overrides")).toHaveCount(1);
}

async function audit(page: Page, testInfo: TestInfo, name: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  await testInfo.attach(`axe-${name}`, {
    body: JSON.stringify(results, null, 2),
    contentType: "application/json",
  });
  expect(results.violations).toEqual([]);
}

test.beforeEach(async ({ page }) => {
  // Browser regressions never post comments or depend on third-party uptime.
  await page.route("https://giscus.app/**", (route) => route.abort());
});

test("keyboard skip link and modal focus remain usable", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.locator(".skip-link")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#content")).toBeFocused();
  await page.locator("#magnifying-glass").focus();
  await page.keyboard.press("Enter");
  const input = page.locator("#search input[type='text']");
  await expect(input).toBeFocused();
  expect(
    await page
      .locator("#search-dialog")
      .evaluate((node) => node.matches(":modal")),
  ).toBe(true);
  // Native modal inertness must prevent even programmatic background focus.
  await page.locator("#magnifying-glass").evaluate((node) => node.focus());
  await expect(input).toBeFocused();
  for (const key of ["Tab", "Shift+Tab"]) {
    for (let index = 0; index < 8; index += 1) {
      await page.keyboard.press(key);
      const focus = await page.evaluate(() => ({
        insideDialog: Boolean(
          document.activeElement?.closest("#search-dialog"),
        ),
        browserChrome:
          document.activeElement === document.body && !document.hasFocus(),
      }));
      // Native dialogs may tab to browser chrome at the document boundary:
      // https://html.spec.whatwg.org/multipage/interaction.html#sequential-focus-navigation
      // No background page control may receive focus, and tabbing back into
      // the document must reach the dialog's corresponding edge control.
      expect(focus.insideDialog || focus.browserChrome).toBe(true);
      if (focus.browserChrome) {
        await page.keyboard.press(key);
        // WebKit first focuses the dialog itself when re-entering from its
        // browser UI. One more key must reach the appropriate child control.
        if (
          await page
            .locator("#search-dialog")
            .evaluate(
              (node) => node === document.activeElement && document.hasFocus(),
            )
        ) {
          await page.keyboard.press(key);
        }
        await expect(
          key === "Tab" ? page.locator("#search-close") : input,
        ).toBeFocused();
      }
    }
  }
  await page.keyboard.press("Escape");
  await expect(page.locator("#search-dialog")).not.toBeVisible();
  await expect(page.locator("#magnifying-glass")).toBeFocused();
  await page.locator(".site-brand").focus();
  await page.keyboard.press("/");
  await expect(input).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator(".site-brand")).toBeFocused();
});

test("search survives result navigation and back/forward without losing its CSS", async ({
  page,
}) => {
  await page.goto("/blog/");
  await page.evaluate(() => {
    (
      window as Window & { __navigationSentinel?: boolean }
    ).__navigationSentinel = true;
  });
  await openSearch(page, "OSTEP");
  const result = page.locator(".pagefind-ui__result-link").first();
  const target = new URL((await result.getAttribute("href"))!, page.url())
    .pathname;
  await result.click();
  await expect(page).toHaveURL((url) => url.pathname === target);
  await expect(page.locator("#search-dialog")).not.toBeVisible();
  expect(
    await page.evaluate(
      () =>
        (window as Window & { __navigationSentinel?: boolean })
          .__navigationSentinel,
    ),
  ).toBe(true);
  await openSearch(page, "OSTEP");
  await assertSearchStyles(page);
  await page.keyboard.press("Escape");
  await page.goBack();
  await expect(page).toHaveURL(/\/blog\/$/);
  await openSearch(page, "OSTEP");
  await assertSearchStyles(page);
  await page.keyboard.press("Escape");
  await page.goForward();
  await expect(page).toHaveURL((url) => url.pathname === target);
  await openSearch(page, "OSTEP");
  await assertSearchStyles(page);
});

test("failed search stylesheet exposes a retry and recovers", async ({
  page,
}) => {
  let blocked = true;
  let failedRequests = 0;
  await page.route(SEARCH_STYLES, (route) => {
    if (blocked) {
      failedRequests += 1;
      return route.abort("failed");
    }
    return route.continue();
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.locator("#magnifying-glass").click();
  await expect(page.locator("#search-retry")).toBeVisible();
  expect(failedRequests).toBeGreaterThan(0);
  blocked = false;
  await page.locator("#search-retry").click();
  const input = page.locator("#search input[type='text']");
  await expect(input).toBeFocused();
  await input.fill("OSTEP");
  await expect(page.locator(".pagefind-ui__result-link").first()).toBeVisible();
  await assertSearchStyles(page);
  expect(errors).toEqual([]);
});

test("closing search while loading does not reopen it or steal focus", async ({
  page,
}) => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  let requested = false;
  await page.route(SEARCH_STYLES, async (route) => {
    requested = true;
    await pending;
    await route.continue();
  });
  await page.goto("/");
  await page.locator("#magnifying-glass").click();
  await expect.poll(() => requested).toBe(true);
  await page.keyboard.press("Escape");
  release();
  await assertSearchStyles(page);
  await expect(page.locator("#search-dialog")).not.toBeVisible();
  await expect(page.locator("#magnifying-glass")).toBeFocused();
  await openSearch(page, "OSTEP");
  await page.locator("#search-close").click();
  await expect(page.locator("#search-dialog")).not.toBeVisible();
  await expect(page.locator("#magnifying-glass")).toBeFocused();
});

test("search engine failure offers an explicit reload recovery", async ({
  page,
}) => {
  let blocked = true;
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/pagefind/pagefind.js*", (route) =>
    blocked ? route.abort("failed") : route.continue(),
  );
  await page.goto("/");
  await page.locator("#magnifying-glass").click();
  await expect(page.locator("#search-reload")).toBeVisible();
  blocked = false;
  await Promise.all([
    page.waitForEvent("load"),
    page.locator("#search-reload").click(),
  ]);
  await openSearch(page, "OSTEP");
  expect(errors).toEqual([]);
});

test("search metadata failure reaches an error state and reload recovery", async ({
  context,
  page,
}) => {
  let blocked = true;
  let failedRequests = 0;
  // Pagefind fetches this generated entry inside its dedicated worker. A
  // context route covers that request as well as fallback main-thread loading.
  await context.route("**/pagefind/pagefind-entry.json*", (route) => {
    if (blocked) {
      failedRequests += 1;
      return route.abort("failed");
    }
    return route.continue();
  });
  await page.goto("/");
  await page.locator("#magnifying-glass").click();
  await expect(page.locator('#search-load-status[role="alert"]')).toBeVisible({
    timeout: 25_000,
  });
  expect(failedRequests).toBeGreaterThan(0);
  await expect(page.locator("#search-retry")).toBeVisible();
  await expect(page.locator("#search-reload")).toBeVisible();
  blocked = false;
  await Promise.all([
    page.waitForEvent("load"),
    page.locator("#search-reload").click(),
  ]);
  await openSearch(page, "OSTEP");
  await expect(page.locator("#search-load-status")).not.toBeVisible();
});

test("home stays minimal and original article navigation remains available", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("#featured-title, #series-title")).toHaveCount(0);
  await expect(page.locator('a[href^="/series/"]')).toHaveCount(0);
  await expect(page.locator(".featured-posts .post-link")).toHaveCount(4);
  await page
    .locator('.featured-posts a[href="/blog/real-mysql-80-8장-인덱스/"]')
    .click();
  await expect(page.locator("h1")).toContainText("인덱스");
  await expect(page.locator('nav[aria-label="다른 글"]')).toBeVisible();
  await expect(page.locator(".series-context")).toHaveCount(0);
  const removed = await page.goto("/series/ostep/");
  expect(removed?.status()).toBe(404);
});

test("theme selection persists across Astro navigation and a reload", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#theme-toggle").click();
  await page.locator('[data-theme-value="dark"]').click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(page.locator("#theme-toggle")).toBeFocused();
  await page.locator('.primary-nav a[href="/blog/"]').click();
  await expect(page).toHaveURL(/\/blog\/$/);
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.locator("#theme-toggle").click();
  await expect(page.locator('[data-theme-value="dark"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.locator('[data-theme-value="system"]').click();
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveClass(/dark/);
});

test("blocked storage does not break theme, disclosures, or search", async ({
  page,
}) => {
  await page.addInitScript(() => {
    for (const name of ["localStorage", "sessionStorage"]) {
      Object.defineProperty(window, name, {
        configurable: true,
        get() {
          throw new DOMException("Storage blocked", "SecurityError");
        },
      });
    }
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(ARTICLE);
  await page.locator("#theme-toggle").click();
  await page.locator('[data-theme-value="dark"]').click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.locator("[data-table-of-contents] > summary").click();
  await expect(page.locator("[data-table-of-contents]")).toHaveAttribute(
    "open",
    "",
  );
  await page.locator('.primary-nav a[href="/blog/"]').click();
  await expect(page).toHaveURL(/\/blog\/$/);
  await expect(page.locator("html")).toHaveClass(/dark/);
  const lastYear = page.locator("[data-year-details]").last();
  if (!(await lastYear.evaluate((node) => (node as HTMLDetailsElement).open))) {
    await lastYear.locator("summary").click();
  }
  await expect(lastYear).toHaveAttribute("open", "");
  await openSearch(page, "OSTEP");
  expect(errors).toEqual([]);
});

test("article anchors, native history, and back-to-top work", async ({
  page,
}) => {
  await page.goto(ARTICLE);
  await page.locator("[data-table-of-contents] > summary").click();
  const anchor = page.locator('[data-table-of-contents] a[href^="#"]').nth(3);
  const hash = (await anchor.getAttribute("href"))!;
  const id = decodeURIComponent(hash.slice(1));
  await anchor.click();
  await expect(page).toHaveURL(
    (url) => decodeURIComponent(url.hash.slice(1)) === id,
  );
  await expect
    .poll(() =>
      page.evaluate(
        (headingId) =>
          document.getElementById(headingId)!.getBoundingClientRect().top,
        id,
      ),
    )
    .toBeGreaterThanOrEqual(0);
  const top = await page.evaluate(
    (headingId) =>
      document.getElementById(headingId)!.getBoundingClientRect().top,
    id,
  );
  expect(top).toBeLessThan(180);
  await page.goBack();
  await expect(page).toHaveURL((url) => !url.hash);
  await page.goForward();
  await expect(page).toHaveURL(
    (url) => decodeURIComponent(url.hash.slice(1)) === id,
  );
  await page.locator('a[href="#top"]').click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(2);
});

test("clipboard rejection is announced and the same control can retry", async ({
  page,
}) => {
  await page.addInitScript(() => {
    let calls = 0;
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        async writeText() {
          calls += 1;
          if (calls === 1)
            throw new DOMException("Clipboard blocked", "NotAllowedError");
        },
      },
    });
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(ARTICLE);
  const button = page.locator(".copy-code").first();
  await button.click();
  await expect(button).toContainText("복사 실패");
  await expect(page.locator(".copy-code-status").first()).toContainText(
    /실패|권한|복사/,
  );
  await button.click();
  await expect(button).toContainText("복사됨");
  expect(errors).toEqual([]);
});

test("comments expose an immediate retry after a network failure", async ({
  page,
}) => {
  let requests = 0;
  await page.route("https://giscus.app/client.js", async (route) => {
    requests += 1;
    if (requests === 1) return route.abort("failed");
    await route.fulfill({
      contentType: "application/javascript",
      body: `
      const frame = document.createElement('iframe');
      frame.className = 'giscus-frame';
      frame.title = '댓글';
      frame.srcdoc = '<p>테스트 댓글</p>';
      document.querySelector('giscus-comments .giscus').append(frame);
    `,
    });
  });
  await page.goto(ARTICLE);
  expect(requests).toBe(0);
  await page.locator("giscus-comments summary").click();
  await expect(page.locator(".comments-status")).toContainText(/못|실패/);
  await page.locator(".comments-retry").click();
  await expect.poll(() => requests).toBe(2);
  await expect(page.locator(".giscus-frame")).toBeVisible();
});

test("320px layout keeps content and theme controls inside the viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  for (const path of ["/", "/blog/", "/tags/", ARTICLE]) {
    await page.goto(path);
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth + 1,
        ),
      )
      .toBe(true);
  }
  await page.locator("#theme-toggle").click();
  const box = await page.locator("#theme-picker").boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(321);
  await page.keyboard.press("Escape");
  await openSearch(page, "OSTEP");
  const dialog = await page.locator("#search-dialog").boundingBox();
  expect(dialog!.x).toBeGreaterThanOrEqual(0);
  expect(dialog!.x + dialog!.width).toBeLessThanOrEqual(321);
});

test("representative routes have no automated WCAG A/AA violations", async ({
  page,
}, testInfo) => {
  for (const [name, path] of [
    ["home", "/"],
    ["archive", "/blog/"],
    ["tags", "/tags/"],
    ["article", ARTICLE],
  ]) {
    await page.goto(path);
    await audit(page, testInfo, name);
  }
});

test("dark article, theme picker, and populated search pass automated accessibility checks", async ({
  page,
}, testInfo) => {
  await page.goto(ARTICLE);
  await page.locator("#theme-toggle").click();
  await page.locator('[data-theme-value="dark"]').click();
  // Assert the previously stale inherited colors directly before the full audit.
  for (const text of await page
    .locator("article li > p, .post-navigation a > span:not(.eyebrow)")
    .all()) {
    await expect(text).toHaveCSS("color", "rgb(215, 226, 219)");
  }
  await expect(page.locator(".footer-inner > p")).toHaveCSS(
    "color",
    "rgb(170, 189, 176)",
  );
  await audit(page, testInfo, "dark-article");
  await page.locator("#theme-toggle").click();
  await audit(page, testInfo, "theme-picker");
  await page.keyboard.press("Escape");
  await openSearch(page, "OSTEP");
  await audit(page, testInfo, "search");
});
