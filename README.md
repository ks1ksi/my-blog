# ks1ksi.io

Personal blog built with Astro, Tailwind CSS v4, MDX, KaTeX, Giscus, and Pagefind.

## Commands

- `npm install`
- `npm run dev`
- `npm run build`
- `npm run preview`

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
- the repository no longer tracks `public/pagefind`
- search is guaranteed in built output such as `npm run build && npm run preview`

## Credits

Based on [Astro Micro](https://astro.build/themes/details/astro-micro/).
