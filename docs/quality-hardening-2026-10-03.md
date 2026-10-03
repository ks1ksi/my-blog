# Quality hardening, 2026-10-03

Baseline: `4a84fdea72ebfdf6c5adc9497f929655adde0ecb`. This change preserves the
existing green editorial design, static architecture, published article URLs,
article code, image bytes, and page-specific variable-font strategy.

## Reader-facing changes

- Search verifies its current stylesheet element, remounts for a replaced page
  root, and ignores interrupted opens. Loading failures expose Korean status,
  retry, and an explicit page refresh for browser-cached module failures. Initial
  metadata/WASM readiness is checked with a bounded timeout. Query-time fragment
  or index-fetch failures inside the upstream default UI remain a known limit.
- Clipboard failures are announced and retryable; blocked/full web storage no
  longer aborts theme or disclosure initialization. Comments remain on demand
  and expose retry plus a GitHub fallback after failure or timeout.
- Home presents four existing posts and two ordered reading paths. OSTEP's 30
  published entries and Real MySQL's two chapters have series positions and
  previous/next navigation. Related posts use actual shared tags. The helper
  validates every curated target and excludes drafts. Navigational hubs stay
  noindex and out of the sitemap; article indexing is unchanged.
- All 495 source image embeds (including draft posts) were inspected as pixels and given meaningful
  Korean aliases. No image content was regenerated or inferred from filenames.
  Dense technical diagrams use concise descriptions of their visible topic or
  structure rather than pretending a short alt can transcribe an entire figure.
- Seven accidental invisible control characters were removed. A literal 2048
  board array is now inline code, so it cannot be mistaken for a wiki link.

## Maintainability and regression protection

- Date display, archive years, footer year, and OG dates share an explicit
  Asia/Seoul timezone. The canonical origin has one shared source for Astro,
  metadata, robots, and output/deployment verification.
- Obsidian resolution is separated from presentation helpers. Ambiguous short
  references cannot silently choose a different note/image; full and relative
  paths resolve deterministically, with source-located diagnostics for missing
  or ambiguous references. Legitimate draft references remain quiet plaintext.
- Browser UI is split into lifecycle, search, stylesheet, theme, storage,
  disclosure, and clipboard modules. CSS is split by responsibility without
  changing its cascade order. No browser-specific history/scroll patch is added.
- Both themes' normal text tokens meet 4.5:1 across standard, muted, hover, and
  pressed surfaces; focus and strong interactive borders meet 3:1. Tests guard
  these pairs and undefined spacing tokens. Main controls have 44px targets;
  inline tags have at least 24px targets. Reduced-motion behavior remains.
- Cached page fonts have length/header and SHA-256 sidecar checks. Missing,
  malformed, or corrupted caches regenerate automatically, including corruption
  beyond the magic bytes. This detects accidental damage, not hostile tampering.
- The normal hosting build now gates formatting, unit tests, tags, types, and
  generated outputs. Strict peer installation replaces the legacy bypass and
  KaTeX is a directly declared dependency. Chromium/WebKit browser scenarios
  run on the Quality workflow before promoting a tested quality branch to main.

## Evidence and boundaries

See [release checks](./quality-and-release.md) for the exact commands and
browser coverage, and the exact commit's GitHub checks for executed results.
Local unit/type/build results and remote browser execution are distinct: the
local cloud shell cannot launch Chromium due an OS socket restriction. WebKit
and mobile emulation are not physical Safari/Samsung or screen-reader tests.
Automated accessibility and Lighthouse scores cannot certify all aspects of
reader experience, content accuracy, security, or search traffic.

The existing 1948 critical-path article contains a screenshot of problem 2848.
The image is retained, and its alt describes what it actually shows. No
replacement submission evidence was invented. This source-content mismatch is
separate from image accessibility.

The unpatched upstream `http-cache-semantics` advisory remains documented in
[the security assessment](./security-dependencies.md). No branch security,
credentials, security headers, external service, or paid tool was changed.
