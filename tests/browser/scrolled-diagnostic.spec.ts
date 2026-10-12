import { test } from '@playwright/test';
test.use({ reducedMotion: 'no-preference' });
test('measure scrolled history rendering', async ({page}) => {
  await page.route('https://giscus.app/**', route => route.abort());
  await page.addInitScript(() => {
    const w = window as any;
    w.fontLog = [];
    const original = document.fonts.load.bind(document.fonts);
    document.fonts.load = async (font, text) => {
      w.fontLog.push({phase:'load',font,faces:[...document.fonts].filter(f=>f.family.includes('Seungil')).map(f=>({family:f.family,status:f.status}))});
      try { const faces = await original(font,text); w.fontLog.push({phase:'loaded',font,count:faces.length,statuses:faces.map(f=>f.status)}); return faces; }
      catch(e) { w.fontLog.push({phase:'error',error:String(e)}); throw e; }
    };
    document.addEventListener('astro:before-swap', () => w.fontLog.push({phase:'before-swap',faces:[...document.fonts].filter(f=>f.family.includes('Seungil')).map(f=>({family:f.family,status:f.status})),styles:[...document.querySelectorAll('style[data-page-font]')].map(x=>({family:(x as HTMLElement).dataset.pageFont,text:x.textContent?.slice(0,180)}))}));
    document.addEventListener('astro:after-swap', () => w.fontLog.push({phase:'after-swap',faces:[...document.fonts].filter(f=>f.family.includes('Seungil')).map(f=>({family:f.family,status:f.status}))}));
  });
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
  console.log(JSON.stringify({fontLog:await page.evaluate(()=>(window as any).fontLog),project:test.info().project.name, before, samples:await page.evaluate(() => (window as any).probe)}));
});
