# 2026-10-03 maintenance verification

Baseline: `cec712ef76770ee63cb4743b32f93b933f8b1526`, built with Node 22 on
the same Mac as the updated production build. Existing URLs and content were
preserved. The original checkout was clean and was not modified.

## Changes and rationale

- Upgrade Astro 6.3.1 to 7.3.5, its integrations, Vite 8, Tailwind 4.3, and
  compatible tooling. Keep the unified Markdown pipeline explicitly to retain
  the existing Obsidian links, math, code highlighting, and output whitespace.
  Pin Node 22 for Cloudflare Pages; Astro requires Node 22.12 or newer.
- Load KaTeX CSS only on the 29 posts with rendered math. Generate a 64px PNG
  favicon from the existing galaxy image. Defer Giscus iframe loading.
- Index article titles and bodies with Pagefind; omit duplicate list/tag pages
  and adjacent-post navigation from search results.
- Parse frontmatter with Astro's YAML parser instead of regular expressions.
  Respect explicit slugs, nested post paths, Markdown extensions in wiki links,
  and nested image references. Tests cover these previously fragile cases.
- Add generated-output checks for local targets and anchors, canonical and
  Open Graph URLs, dates, math styles, sitemap coverage, crawl rules, and search
  coverage. Preserve existing metadata, public paths, feeds, and robots policy.
- Correct three obvious Korean typos in OSTEP 33. Do not alter its technical
  claims, code examples, publication dates, or URL.
- Retain the Samsung Internet workaround after reviewing upstream evidence;
  replace patch-package with a small version-guarded, tested install script.
  See [the investigation and removal criteria](../patches/README.md).

## Deterministic asset measurements

Run `node scripts/measure-build.mjs <build-directory>` on each build. Gzip uses
Node's default `gzipSync`; it is a comparable file-size measurement, not a claim
about Cloudflare's negotiated compression or a measured Core Web Vitals score.

| Metric | Before | After | Reduction |
| --- | ---: | ---: | ---: |
| Home CSS, raw bytes | 137,662 | 122,047 | 11.3% |
| Home CSS, gzip bytes | 32,680 | 26,669 | 18.4% |
| Favicon, bytes | 348,586 | 8,160 | 97.7% |
| Entire Pagefind directory, bytes | 1,580,901 | 1,524,266 | 3.6% |
| Indexed documents | 335 | 283 | 52 duplicate navigation/list pages omitted |

The search directory is downloaded on demand; its total size is not the initial
page payload. All 283 published posts remain indexed. Build timings varied
(baseline 63.99s, updated runs 57.90–68.08s including extra output checks), so no
build-speed improvement is claimed. Search rankings and field traffic were not
measured.

## Validation

- Clean `npm ci`, strict peer-resolution dry run, Prettier lint, Astro type
  checks, and the production build passed.
- 18 tests passed across four suites (baseline: nine tests).
- All 335 generated HTML pages passed metadata and content checks: 283 posts,
  29 math pages, 11,093 local references, 285 sitemap URLs, 50 full-content RSS
  items, and no broken local anchors or rendered KaTeX errors.
- Before/after route sets are identical. Normalized article text is identical
  for 282 posts; the remaining post differs only at the three corrected typos.
- Chrome checks covered home layout, search and article navigation, code and
  math rendering, deferred comments, and responsive layout at 390 × 844.
  Back navigation restored `/blog/` at 657px and the OS tag list at 785px.
- Samsung, Chrome, and Safari UA fixtures exercise the installed scroll handler;
  a physical Samsung Internet device was unavailable. UA tests are not device
  validation.

## Remaining upstream issue

`npm audit` fell from 25 entries (one critical, 15 high, eight moderate, one low)
to two high entries representing one advisory in `http-cache-semantics` and its
Astro parent. As of this review, 4.2.0 is the latest package release and has no
patched version. The site emits static files and does not run Astro's response
cache in production. Keep tracking the advisory; do not apply the audit tool's
suggested incompatible downgrade to Astro 2.

- [Astro 7 migration](https://docs.astro.build/en/guides/upgrade-to/v7/)
- [Astro support policy](https://docs.astro.build/en/upgrade-astro/)
- [Remaining advisory GHSA-ch52-4w7c-c8xp](https://github.com/advisories/GHSA-ch52-4w7c-c8xp)
