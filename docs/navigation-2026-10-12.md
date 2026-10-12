# Restore the standard Astro transition

The reported remaining flash occurs when opening an article from a scrolled
list. The previous opacity checks clicked the first card, which Playwright
could scroll into view before navigation; they did not cover that condition.

Use `<ClientRouter />` with Astro's default animation and fallback, and remove
`transition:animate="none"` from the root. This restores the standard crossfade
instead of adding another transition implementation. The fade is intentional;
zero opacity throughout the transition is no longer a valid test requirement.

Keep the independently reproduced fixes for stale reload scroll positions and
page-specific font decoding across head swaps. Removing those would reintroduce
known regressions. This change is therefore a return to default **visual
transitions**, not a removal of all application lifecycle handlers.

The article-entry regression now clicks a visible card at scrollY=1200 and
checks the incoming title geometry, font readiness, theme and scroll position
from the swap through 30 animation frames, then exercises Back and Forward.
It covers light/dark themes, native transitions and fallback, on all four
Playwright projects. Device emulation does not establish a physical-phone fix.

## Lighthouse sample before this transition change

Production commit: `5d44450855a05a3f2d2e7ded7415584c9b4ef84f`, verified before and
after measurement. Lighthouse 13.5.0, one run per page/device on GitHub Actions,
2026-10-12 21:10 KST. These are lab samples, not scores for every page or a
repeatable 100-point guarantee. This measures initial navigation, not SPA clicks.

| Page / device | Performance | Accessibility | Best practices | SEO |
| --- | ---: | ---: | ---: | ---: |
| Home / mobile | 91 | 100 | 100 | 100 |
| Home / desktop | 100 | 100 | 100 | 100 |
| 2024–2025 retrospective / mobile | 96 | 100 | 100 | 100 |
| 2024–2025 retrospective / desktop | 100 | 100 | 100 | 100 |

[Measurement run and retained JSON reports](https://github.com/ks1ksi/my-blog/actions/runs/38247275764).
