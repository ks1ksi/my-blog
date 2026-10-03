# Page-specific variable fonts — 2026-10-03

Baseline commit: `7eddce69aa516f5370e8e4bd02a45875f44f1c1d`.

## Motivation and measurements

The deployed home and desktop article had already reached 100 in some PageSpeed
runs. The representative article's mobile performance still varied between 86
and 88; accessibility, best practices, and SEO were 100. These are separate
laboratory samples, not a field-data trend or a guarantee for every page.

- [Mobile article baseline, score 86](https://pagespeed.web.dev/analysis/https-ks1ksi-io-blog-2024---2025-%ED%9A%8C%EA%B3%A0/to3p4ew09z?form_factor=mobile)
- [Later mobile article baseline, score 88](https://pagespeed.web.dev/analysis/https-ks1ksi-io-blog-2024---2025-%ED%9A%8C%EA%B3%A0/awcwsypbr4?form_factor=mobile)

The first report listed 16 Pretendard font-subset requests totaling 418.34 KiB.
Several stock subsets downloaded tens of kilobytes for individual uncommon
Korean characters. The fonts already used `font-display: swap`; there was no
font-ready rendering gate. This proves excess font transfer, not that fonts
alone caused all of the reported LCP render delay. A post-deployment run is
needed to quantify the performance effect.

## Implementation

- After Astro renders each page, collect its actual body characters, including
  collapsed UI and template content. Keep ASCII and UI punctuation. Code and
  math retain their existing dedicated fonts.
- Use HarfBuzz/WOFF2 through Node WASM packages to make a variable-font subset.
  Preserve original outlines, metrics, hinting, variation axis, and license
  metadata. Rename generated font identities, including named-instance
  PostScript names, to respect the original reserved font name.
- Preload the one page-specific face and use it first with `font-display: swap`.
  Its exact unicode range and the unchanged original font faces cover dynamic
  search results, new user input, and other characters outside that page.
- Let Astro's native head swapping replace the page font on navigation. Do not
  add browser detection, scrolling workarounds, artificial paint delays, or
  Lighthouse-specific behavior.
- Hash public URLs from the actual output bytes. Build cache keys also cover
  source font bytes, generator code, and the dependency lockfile. The original
  OFL notice ships at `/_astro/pretendard-OFL.txt`.

## Deterministic build sizes

| Item | Before | After |
| --- | ---: | ---: |
| Home HTML, gzip | 29,185 B | 29,934 B |
| Representative article HTML, gzip | 31,085 B | 32,067 B |
| Home page-specific font | — | 66,796 B |
| Representative page-specific font | — | 82,748 B |
| Separate blocking CSS requests on home | 0 | 0 |
| Published posts / indexed posts | 283 / 283 | 283 / 283 |

These are file-size measurements, not measured browser transfer totals.
Dynamic search can still request the original subsets. The tradeoff is a small
per-page CSS addition, extra build work, and page-specific font downloads when
visiting different pages; stock subsets can otherwise share more cache across
many pages. Repeat visits reuse immutable content-hashed files.

## Verification

- Final full build: 335 pages, 283 posts, 29 math pages, 285 sitemap URLs,
  283 indexed posts, no SEO/content/link/anchor/font-loading failures
- All 335 generated HTML documents are byte-identical to baseline after removing
  only the newly injected font preload and font style
- All 792 tracked post and image files retain their original checksums
- 18 unit tests passed; Astro check reported zero errors, warnings, or hints;
  formatting and whitespace checks passed
- Independent FontTools comparison of the representative subset found identical
  outlines and advance widths for all 333 mapped code points at weights 400,
  550, 650, and 700; the 45–930 variation axis remains intact
- Independent source review checked font naming, metadata, SFNT checksum,
  cache invalidation, content-hashed URLs, and native Astro head swapping

The cloud environment blocked local Chromium sockets and cloud-browser localhost
access. Local visual/navigation/Lighthouse testing was therefore not performed;
production browser checks and fresh public PageSpeed reports remain necessary.
