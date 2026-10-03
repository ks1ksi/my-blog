# ks1ksi.io

Personal blog built with Astro, Tailwind CSS v4, MDX, KaTeX, Giscus, and Pagefind.

## Commands

- Node.js 22.12+ (the build uses the Node 22 LTS line from `.node-version`)
- `npm ci`
- `npm run lint`
- `npm run check`
- `npm test`
- `npm run dev`
- `npm run build`
- `npm run preview`
- `npm run test:browser:install` (one-time local Chromium/WebKit installation)
- `npm run test:browser` (after building)
- `npm run check:production -- --commit <full commit SHA>`

`build` gates formatting, unit tests, tag taxonomy, and Astro types before
producing the site. Generated checks cover SEO metadata, sitemap coverage,
robots, local links and anchors, image alt quality, math styles, fonts, and the
search index. The Quality GitHub Actions workflow also runs Chromium and WebKit
regressions at desktop/mobile sizes with automated accessibility checks. A clean
Node 22 install uses strict peer resolution; no legacy bypass is enabled.

`dist/build-info.json` identifies the exact source commit and checkout
cleanliness. Production verification requires that identity before checking
public endpoints. See [quality and release checks](docs/quality-and-release.md)
for coverage and limitations.

Navigation and scroll restoration
use Astro’s unmodified `ClientRouter`; dependencies are not patched at install.

Production builds generate a content-hashed variable-font subset for each page
using the same Pretendard outlines, weights, and metrics. The original unicode
subsets remain available for dynamic search results and input. The generated
faces have distinct font names and retain the original font license. Subsetting
runs entirely in Node/WASM, with build-only caches under `node_modules/.astro`;
no Python or browser-time font processing is required.

## Structure

- `src/pages`: Astro routes for home, blog, tags, RSS, and error pages
- `src/content/blog`: Markdown and MDX posts
- `src/content/images`: images referenced from posts
- `src/layouts` and `src/components`: shared page shell and UI building blocks
- `src/lib`: content/discovery selectors, Markdown helpers, and browser UI modules
- `src/config/site.mjs`: shared canonical URL, locale, and KST timezone
- `src/styles`: theme tokens and ordered base/layout/article/search/responsive styles
- `tests/browser`: navigation, failure-recovery, viewport and accessibility regressions

## Writing Posts

Posts live in `src/content/blog` and use this frontmatter shape:

```md
---
title: Example Title
date: 2026-01-01
tags:
  - life
draft: false
---
```

- `title` and `date` are required
- `description`, `tags`, and `draft` are optional
- `[[wiki links]]` and `![[image embeds]]` are supported through a custom remark plugin
- embedded images should live in `src/content/images`; use meaningful aliases such
  as `![[diagram.png|프로세스 상태가 실행, 준비, 대기 사이에서 바뀌는 과정]]`
- use full/relative paths when multiple notes or images share a basename; missing
  or ambiguous references produce source-located warnings instead of arbitrary links
- keep literal array expressions such as `[[1, 2], [3, 4]]` inside inline code
- curated post and series references in `src/lib/discovery.ts` are verified during
  tests/build; update that curation when removing or making an included post private

The starter template is available at `src/content/templates/template.md`.

## Obsidian

If you want to edit posts in Obsidian, open `src/content` as the vault.

- shared vault settings are tracked in `src/content/.obsidian`
- personal workspace state in `src/content/.obsidian/workspace.json` is ignored
- plugin files stay tracked so a fresh clone can be opened and edited right away

## Search

Search uses Pagefind.

- the search index is generated during `npm run build`
- only published article titles and bodies are indexed; lists, navigation and comments are excluded
- the repository no longer tracks `public/pagefind`
- search is guaranteed in built output such as `npm run build && npm run preview`

## Credits

Based on [Astro Micro](https://astro.build/themes/details/astro-micro/).
