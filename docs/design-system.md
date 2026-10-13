# Blog interface

Use Astro-rendered HTML and shared CSS tokens in `src/styles/tokens.css`. The small `global.css` entry imports
tokens, base, layout, article, search, and responsive rules in a fixed order.
Keep introductions factual: the author's name, role, and existing stack. Avoid
slogans or invented descriptions of the author's work.

## Color and interaction

Neutral zinc grays on white (light) and near-black `#0f0f10` (dark), with one
ink-navy accent (`#284b7a` / `#9dbbe3`) for links, hover and focus only. Body text,
secondary text, borders, accents, visited links, and focus indicators have
separate roles.

Shape: separate content with whitespace rather than rules and outlined boxes.
Groups of links (year jumps, home topics, tags) are plain text links, and tags
are always written `#tag`: in post cards, under article titles and on the tag
index. Only panels get a surface: table of contents, code, post navigation and
search results are borderless rounded surfaces. Hairlines remain only under the
sticky header, above the footer and in tables. Internal links have no ↗ marker;
it is reserved for external links.

Post lists separate cards with a hairline. Code blocks use GitHub-like token
colors (`--astro-code-*`) on the muted surface, with the language label and a
quiet icon copy control in a top row.

Scale tokens in `tokens.css` (use these instead of literal values):

- Type: `--text-xs` 13 / `sm` 14 / `md` 15 / `base` 16 / `lg` 18 / `xl` 20 /
  `2xl` 24 px, `--text-display` for page and article titles, `--text-hero` for
  the home name. Article body text keeps its 17px reading size.
- Weight: `--weight-regular` 400, `--weight-medium` 500, `--weight-bold` 650.
- Tracking: `--tracking-tight` for headings, `--tracking-display` for large titles.
- Radius: `--radius-sm` 6px controls, `--radius` 12px panels, `--radius-lg` 16px
  dialogs.

- Current navigation: server-rendered `aria-current`, strong text color
  and underline. The header is replaced during Astro navigation so this stays current.
- Article links and search results: browser-native `:visited` uses muted gray
  (`#52525b` light, `#a1a1aa` dark), with the saturated accent reserved for hover
  and focus. Body reference links use the same visited color. Navigation, table
  of contents, and in-page anchors keep their normal color after a visit.
  Card titles take the accent and an underline on hover or focus. No application
  visit history.
- Keyboard focus: a 3px outline, including a full-card outline for article links.
- Expanded years: a minus sign; collapsed years have a plus sign.
- Hash targets: heading/section outline, with CSS scroll padding below the header.
- Theme selection: a sun/moon icon opens a native HTML `popover="auto"` with
  Light / Dark / System choices, labeled 라이트 모드 / 다크 모드 / 시스템 설정.
  The selected option has a check mark and `aria-pressed`; choosing an option
  restores focus to the trigger. The browser handles Escape and outside clicks.
  Search uses a native dialog with Pagefind.
- Table of contents: native details, initially collapsed, honoring the existing
  session preference. Navigation/scroll restoration belongs to Astro ClientRouter.
- Reduced motion: suppress decorative transitions and animations.

Automated token tests cover body, strong, secondary, accent, and visited text
on page, standard, muted, hover, and pressed surfaces in both themes. These text
pairs meet 4.5:1; focus and strong control boundaries meet 3:1. The 2026-10-03
hardening slightly deepens the light secondary color and lightens the dark one
to retain that contrast on pressed surfaces as well. This is a token-level
regression guard, not a substitute for rendered-page accessibility checks.
The search placeholder uses the secondary text color at full opacity.
Visited links contrast with the page background at 5.49:1 in light mode and
8.33:1 in dark mode, and remain above 4.5:1 on hover/pressed card backgrounds.

## Layout

Use one column for posts. Distinguish page titles, article titles, section titles,
and metadata through type size and spacing. Page content has a 64rem maximum
container, articles 52rem, with 1rem mobile gutters. Header controls are at least
44px high; smaller inline tags retain spacing from neighboring controls.

## Verification on 2026-10-03

Against `ec74dcb218e54e65bac3f764fcf1b3e96144ba10`:

- All 335 HTML routes and the normalized bodies of all 283 articles are unchanged.
  Canonical/Open Graph metadata, crawl directives, 285 sitemap URLs, 50 RSS items,
  and 283 indexed articles remain intact.
- Lint, Astro type checks, 11 content tests, production build, SEO checks, and
  12,106 local-reference checks pass.
- Home CSS: 122,047 to 112,077 bytes; gzip: 26,669 to 25,147 bytes.
  Shared UI JavaScript: 7,277 to 6,782 bytes; gzip: 2,830 to 2,672 bytes.
  These are same-machine file-size comparisons, not Core Web Vitals measurements.
- Chrome visual checks cover light/dark themes, 320px/390px layouts, search,
  visited results, active navigation, native disclosures, and article anchors.
  Theme checks also cover the selected option, focus return, Escape dismissal,
  system preference, and popover bounds at 320px.
  The RAID section lands 96px below the top at 390px viewport width.

A physical Samsung Internet device is unavailable. No browser-specific branches
or manual history/scroll restoration have been reintroduced.

## Theme control references

- [shadcn/ui mode toggle](https://ui.shadcn.com/docs/dark-mode/vite): sun/moon
  trigger and Light / Dark / System choices. Use the interaction pattern without
  adding React or component-library dependencies.
- [Apple's Korean appearance terminology](https://support.apple.com/ko-kr/guide/mac-help/mchl52e1c2d2/mac).
- [MDN popover](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/popover):
  browser-managed opening, Escape, and outside-click dismissal.
