# Header rendering and initial-page performance

## What was reproduced

Production `749df2404627d2439d404e789e3bb9cdf23bae37` was inspected with
Chromium compositor screencasts, using touch navigation from a home page
scrolled to 400px and the archive scrolled to 1200px. Light/dark and native /
forced-fallback navigation produced eight recordings. Every captured pixel in
the stable logo region matched the pre-navigation reference (mean difference
0). This does **not** reproduce or disprove a flash on a physical phone.

The same diagnostic exposed an incorrect intermediate state in every dark
scenario: immediately after Astro's DOM swap, before scroll restoration and
`astro:after-swap`, the header background was `rgb(247, 246, 242)` instead of
`rgb(19, 28, 25)`. The old after-swap theme handler then corrected it. Preparing
the incoming document's theme before the swap removes that incorrect state.
No claim is made that an unobserved physical-device flash has been proven fixed.

Baseline evidence:
https://github.com/ks1ksi/my-blog/actions/runs/38275457165

## Changes and regression coverage

- Apply the selected/system theme and control state to the incoming document
  before Astro replaces root attributes. Retain normal Astro transitions,
  header snapshot isolation and the existing font/scroll preparation.
- Assert the header color immediately inside the swap, before the after-swap
  handler can mask a regression. Test stored choices against the opposite OS
  theme on Chromium/WebKit, desktop/mobile, native/fallback navigation.
- Add a compositor-pixel audit to Quality. Preserve all captured header frames
  as filmstrips and compare the stable logo region with the reference. The
  selected navigation link may legitimately change on home-to-article entry.
- Move the 92 stock Pretendard fallback font-face declarations out of initial
  HTML into a lazy search stylesheet. Page-specific fonts still serve every
  static page character, with the same design, weights and swap behavior.
  Search loads the full fallback declarations before mounting its UI. Existing
  stylesheet restoration/retry behavior also applies to the fallback file.
- Verify search renders a glyph absent from the home page subset, and restores
  both search stylesheets after navigation and Back/Forward.

The built home HTML dropped from roughly 131KB to 83KB uncompressed, or 31KB
to 16KB with local gzip. These are payload measurements, not Lighthouse scores.

## Performance measurements

The pre-change production baseline was measured using Lighthouse 13.5.0,
three fresh mobile audits per page on one GitHub Actions runner. Home
performance was 93/100/100; the representative retrospective article was
100/100/100. Accessibility, best practices and SEO were 100 throughout.

Baseline evidence:
https://github.com/ks1ksi/my-blog/actions/runs/38274514514

`Production performance` waits for the pushed clean commit to be deployed,
then records all three mobile runs and one desktop run for both pages, using
default Lighthouse throttling. It verifies build identity before and after
measurement and preserves every raw JSON report. A completed workflow means
measurement succeeded; consult its scores rather than treating job success
as a 100-point assertion. Scores from a previous commit are not release proof.
