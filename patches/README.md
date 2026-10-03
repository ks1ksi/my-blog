# Astro Samsung Internet workaround

The workaround is applied by `scripts/patch-astro.mjs` during `npm ci` / `npm install`.
Astro is pinned to **7.3.5**. The script is idempotent and fails if the version or
handler changes, so future upgrades require a deliberate review. This replaces
`patch-package` and the old `astro+6.3.1.patch`, without removing the workaround.

## Why it remains (reviewed 2026-10-03)

The original local change was commit `20f9c9a` (2026-05-01). Samsung Internet's
native “Go to top” button stopped appearing after ClientRouter navigation when
Astro wrote scroll positions through `history.replaceState()` at `scrollend`.
Only that scroll-end write is skipped for the `SamsungBrowser/` user agent.
Navigation-start writes and the site's one-shot return-scroll restoration remain.

- [Astro issue #9752](https://github.com/withastro/astro/issues/9752) describes the
  same native button issue. It was closed because the maintainers could not
  investigate it, **not because a fix shipped**.
- [Astro PR #16025](https://github.com/withastro/astro/pull/16025) avoids duplicate
  browser/ClientRouter animations during history navigation. It does not remove
  the `scrollend` history write, which remains in the installed 7.3.5 router.
- [Samsung's Android release notes](https://developer.samsung.com/browser/release-note/android-release-note.html)
  did not provide evidence that this native UI behavior is fixed. The public page
  is dated and cannot establish current-device behavior.
- [MDN's compatibility data](https://github.com/mdn/browser-compat-data/blob/main/api/Document.json)
  records Chromium support for `scrollend` and `startViewTransition`, which
  Samsung Internet inherits. API support does not establish whether Samsung's
  native button responds correctly to history writes.

`src/lib/astro-patch.test.ts` executes the installed handler with Samsung, Chrome,
and Safari user-agent fixtures. Return-scroll tests cover blog and tag lists.
These are code regression checks, **not Samsung device tests**.

Remove the workaround only after a clean unpatched install passes on an actual
Samsung Internet device:

1. ClientRouter navigation followed by scrolling on a long post shows the native
   “Go to top” button, and the button works.
2. Opening a post from `/blog/` or `/tags/*/` and going back restores list position.

No Samsung device was available for the 2026-10-03 review.
