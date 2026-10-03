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

`build` also checks generated SEO metadata, sitemap coverage, robots, local links
and anchors, math styles, and the search index. Navigation and scroll restoration
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
- `src/lib`: shared content selectors, markdown helpers, and browser-side UI logic

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
- embedded images should live in `src/content/images`

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
