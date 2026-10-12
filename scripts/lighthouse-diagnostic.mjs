import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
const origin='https://ks1ksi.io';
const expected='749df2404627d2439d404e789e3bb9cdf23bae37';
async function identity(){const r=await fetch(`${origin}/build-info.json?lh=${Date.now()}`,{cache:'no-store'});const data=await r.json();console.log('BUILD_IDENTITY',JSON.stringify(data));if(!JSON.stringify(data).includes(expected))throw new Error('Production changed while measuring');}
await identity();
mkdirSync('lighthouse-reports',{recursive:true});
for(const [page,path] of [['home','/'],['article','/blog/2024---2025-회고/']]){
  for(const device of ['mobile']) for(let run=1;run<=3;run++){
    const output=`lighthouse-reports/${page}-${device}-${run}.json`;
    execFileSync('npx',['--yes','lighthouse@13.5.0',new URL(path,origin).href,'--chrome-flags=--headless --no-sandbox','--quiet','--only-categories=performance,accessibility,best-practices,seo','--output=json',`--output-path=${output}`,...(device==='desktop'?['--preset=desktop']:[])],{stdio:'inherit',timeout:150000});
    const r=JSON.parse(readFileSync(output,'utf8'));
    console.log('LIGHTHOUSE_RESULT',JSON.stringify({page,device,run,url:r.finalDisplayedUrl,version:r.lighthouseVersion,fetchTime:r.fetchTime,error:r.runtimeError,scores:Object.fromEntries(Object.entries(r.categories).map(([k,v])=>[k,v.score===null?null:Math.round(v.score*100)])),metrics:Object.fromEntries(['first-contentful-paint','largest-contentful-paint','cumulative-layout-shift','total-blocking-time'].map(k=>[k,r.audits[k]?.displayValue])),issues:Object.values(r.audits).filter(a=>a.score!==null&&a.score<1&&a.scoreDisplayMode!=='informative').map(a=>({id:a.id,title:a.title,score:a.score,detail:a.displayValue}))}));
  }
}
await identity();
