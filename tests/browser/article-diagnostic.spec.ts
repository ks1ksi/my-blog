import { test, expect } from '@playwright/test';
for (const theme of ['light','dark'] as const) {
  for (const skip of [false, true]) {
    test(`${theme} article entry ${skip ? 'skip' : 'native'}`, async ({page}) => {
      await page.emulateMedia({colorScheme:theme,reducedMotion:'no-preference'});
      await page.addInitScript(({theme,skip}) => {
        localStorage.setItem('theme', theme);
        const w = window as any;
        w.probe = {frames:[], transitions:[]};
        document.addEventListener('astro:before-swap', (e:any) => {
          const result = {ready:'pending', native:!!document.startViewTransition};
          w.probe.transitions.push(result);
          e.viewTransition.ready.then(()=>result.ready='displayed',()=>result.ready='skipped');
          if (skip) e.viewTransition.skipTransition();
        });
        document.addEventListener('astro:after-swap', () => {
          const sample = (phase:string) => {
            const title=document.querySelector('h1')!;
            const family=(document.querySelector('style[data-page-font]') as HTMLElement)?.dataset.pageFont;
            w.probe.frames.push({phase,y:scrollY,height:document.body.scrollHeight,title:title.getBoundingClientRect().y,background:getComputedStyle(document.body).backgroundColor,dark:document.documentElement.classList.contains('dark'),font:family&&document.fonts.check(`16px "${family}"`,'A'),animations:document.getAnimations().map(a=>({pseudo:(a.effect as KeyframeEffect)?.pseudoElement,frames:(a.effect as KeyframeEffect)?.getKeyframes()}))});
          };
          sample('swap');
          let left=30;
          const frame=()=>{sample('frame');if(--left)requestAnimationFrame(frame)};
          requestAnimationFrame(frame);
        });
      },{theme,skip});
      await page.route('https://giscus.app/**',r=>r.abort());
      await page.route('**/*.woff2*',async r=>{await new Promise(resolve=>setTimeout(resolve,150));await r.continue()});
      await page.goto('/blog/');
      await page.locator('[data-year-state-bound="true"]').first().waitFor();
      await page.evaluate(async()=>{await document.fonts.ready});
      const link=page.locator('main h3 a').first();
      const path=new URL((await link.getAttribute('href'))!,page.url()).pathname;
      await link.click();
      await expect(page).toHaveURL(u=>u.pathname===path);
      await page.waitForFunction(()=>(window as any).probe.frames.length>=31);
      const probe=await page.evaluate(()=>(window as any).probe);
      console.log('ARTICLE_PROBE '+JSON.stringify({project:test.info().project.name,theme,skip,path,...probe}));
      await test.info().attach('article.png',{body:await page.screenshot(),contentType:'image/png'});
    });
  }
}
