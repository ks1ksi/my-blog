import { test } from '@playwright/test';
test.use({ reducedMotion: 'no-preference' });
test('measure scrolled history rendering', async ({page}) => {
  await page.route('https://giscus.app/**', route => route.abort());
  await page.goto('/blog/');
  await page.locator('[data-year-state-bound="true"]').first().waitFor();
  await page.evaluate(async () => { await document.fonts.ready; });
  await page.evaluate(() => window.scrollTo(0, 1200));
  const before = await page.evaluate(() => ({ y:scrollY, h:document.body.scrollHeight, fonts:document.fonts.status }));
  await page.locator('.site-brand').evaluate((a) => (a as HTMLAnchorElement).click());
  await page.waitForURL(url => url.pathname === '/');
  await page.evaluate(async () => { await document.fonts.ready; });
  await page.evaluate(() => {
    const w = window as any;
    w.probe = [];
    const sample = (phase:string) => w.probe.push({phase, t:performance.now(), y:scrollY, h:document.body.scrollHeight, fonts:document.fonts.status, family:getComputedStyle(document.body).fontFamily});
    document.addEventListener('astro:after-swap', () => {
      sample('swap');
      let left = 40;
      const frame = () => { sample('frame'); if (--left) requestAnimationFrame(frame); };
      requestAnimationFrame(frame);
      document.fonts.ready.then(() => sample('fonts-ready'));
    });
  });
  await page.goBack();
  await page.waitForURL(/\/blog\/$/);
  await page.waitForFunction(() => (window as any).probe?.filter((x:any) => x.phase==='frame').length >= 40);
  console.log(JSON.stringify({project:test.info().project.name, before, samples:await page.evaluate(() => (window as any).probe)}));
});
