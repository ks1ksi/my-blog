# Header stability during article navigation

The header still flashed on a phone after the previous rounds
([navigation](navigation-2026-10-12.md),
[rendering](rendering-and-performance-2026-10-13.md)). Those rounds kept
native View Transitions and tried to make the header look identical inside
the snapshots. They were verified only in desktop emulation on localhost,
where no flash ever reproduced.

## Causes

1. **Native View Transition snapshots.** Every navigation replaced the whole
   page with snapshot pseudo-elements: a root crossfade, then root
   `animate="none"`, then a separately named header. Each version passed in
   emulation and still flashed on the phone. Snapshot compositing and
   browser-UI tinting during a transition are device/browser specific (see
   WebKit bugs [279962](https://bugs.webkit.org/show_bug.cgi?id=279962) and
   [300877](https://bugs.webkit.org/show_bug.cgi?id=300877)), so they cannot
   be ruled out by pixel tests on a desktop Chromium.
2. **The header font changed on every page.** Each page has its own font
   subset with a distinct family name, and the header used it. Navigation
   waits up to 2 seconds for the next subset. With a slow mobile connection
   (Chromium, 400 ms latency, 40 KB/s, 4× CPU) an article subset took longer.
   The swap then happened with the new family unloaded, and screencast frames
   showed `Seungil Kim`, `글` and `태그` drawn in a fallback font before the
   subset arrived. This is reproducible and independent of transitions.

## Changes

- Hide `document.startViewTransition` before Astro's router reads it and use
  `<ClientRouter fallback="swap" />`. Navigation replaces the document in one
  task, then scrolls, before the next paint. No snapshots are taken and no
  animation runs. The header's `transition:name`/`animate` are removed.
- Generate one shared header subset (`Seungil Sans UI`, about 9 KB) from the
  text of the site header on all pages, and declare it in a byte-identical
  `<style data-ui-font>` on every page. Astro keeps identical head styles
  across navigation, so the decoded face is never removed or replaced. The
  header uses it first and falls back to the page stack for anything else.
  Outlines, weights and metrics are unchanged: the header is pixel-identical
  to the previous production build (light/dark, Pixel 7 and desktop).
- Navigation font preparation reads the page subset URL from its own
  `@font-face`, since each page now preloads two fonts.

## Verification

- Slow-network repro above: before, header text changed font after the swap;
  after, the header font stays decoded throughout. Without throttling, every
  captured header frame matches the pre-navigation header.
- `sticky-header.spec.ts` delays page subsets by 3 seconds, asserts no View
  Transition starts, and samples the live header from the swap for 20 frames:
  same position, size, opacity and background, and the header font loaded.
- Unit tests cover header-character extraction and identical markup.
  `content-check` verifies both font declarations on every page.

This removes the mechanisms above; it has not been observed on the user's
physical phone. The page body still uses the per-page subset and can show a
fallback font briefly on a very slow connection, as before.

## Follow-up: content fade

The user confirmed the fix on a Galaxy phone (Chrome) and asked for a
transition again. It uses Astro's fallback animation instead of native View
Transitions: `<ClientRouter fallback="animate" />` with
`transition:animate="fade"` on `<main>` only. The old content fades out on the
real DOM (180 ms), the document is swapped, and the new content fades in. No
snapshots are taken; the header and footer have no animation and are never
hidden. Reduced motion disables the fade.

`sticky-header.spec.ts` now also checks that `<main>` fades in while the header
stays at full opacity. Screencasts at normal speed and the header render audit
still show no header pixel changes.
