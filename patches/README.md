# Astro patches

## `astro+6.1.5.patch`

This patch keeps Samsung Internet's native "Go to top" button working when
Astro's `<ClientRouter />` is enabled.

Astro's transition router stores scroll positions by calling
`history.replaceState()` from its `scrollend` handler. Samsung Internet appears
to treat that repeated history state mutation during user scrolling as a signal
that interferes with its native scroll UI heuristics, so the browser button does
not appear on long pages.

The patch skips Astro's `scrollend` scroll-position write only for Samsung
Internet. Astro navigation-start and page-level return-scroll logic remain in
place, so normal route changes can still preserve the scroll positions this site
needs.

Re-check this patch when upgrading Astro or when Samsung Internet changes this
behavior. It can be removed if a clean install without the patch passes both:

- Samsung Internet shows its native "Go to top" button on long pages after
  ClientRouter navigation.
- `/blog` and `/tags/*` still restore scroll position after opening a post and
  going back.
