# Quality checks and release verification

## Required commands

Use Node 22.12+ on the Node 22 line selected by `.node-version`.

```sh
npm ci
npm run build
npm run test:browser:install
npm run test:browser
```

`npm run build` fails before generating a deployable site when formatting, unit
regressions, or tag taxonomy checks fail. It then runs Astro's type checker and
static build, font subsetting, generated SEO/content checks, and build metadata.
`npm run build:site` is the internal build stage; do not use it as the hosting
build command because it deliberately omits the preceding quality gates.
`npm run check:ci` runs the normal build and then browser tests after browsers
have been installed.

`.npmrc` enables strict peer dependency resolution. The legacy-peer-deps bypass
was removed after a strict resolution dry run and a clean `npm ci` succeeded.
KaTeX is a direct dependency because site code imports its CSS; the existing
0.16.x renderer line is retained.

## Browser coverage

The Quality workflow runs on pull requests, main pushes, quality/** pushes, and
manual dispatch. It uses `npm ci`, the gated build, and Playwright's Chromium
and WebKit engines with desktop and mobile device/viewport emulation. Tests
cover:

- Keyboard skip navigation, dialog focus containment, Escape, and focus return
- Search results through Astro navigation, reopening, browser Back and Forward,
  replacement stylesheets, load failure/retry, and interrupted loading
- Theme persistence, system appearance, and local/session storage denial
- Article heading links, native hash history, and back-to-top
- Clipboard rejection and retry; deferred comments network failure and retry
- 320px horizontal overflow and popover/dialog bounds
- Curated series navigation and representative WCAG A/AA axe scans, including
  dark mode and populated search

Third-party comments are intercepted in tests; they never post a comment or
require an external account. Failure traces, screenshots, HTML reports, and axe
results are retained as workflow artifacts for seven days. The suite
uses no credentials. Browser tests inspect the built site via `astro preview`;
`PLAYWRIGHT_BASE_URL` can point at an explicitly selected origin when checking
an existing deployment.

Automated axe checks do not establish full WCAG conformance. Playwright WebKit
is not a test on actual Safari hardware; mobile emulation does not establish
physical iPhone or Samsung Internet behavior. Manual device, screen-reader,
visual, and real user performance verification remain separate.

Local verification on 2026-10-03 used Node 24.19.0, not the CI Node 22 runtime.
A system Chromium launch was blocked by the workspace's Unix-socket restriction
(`socket() failed: Operation not permitted`). Browser discovery and TypeScript
validation can run locally, but a passing browser result must come from an
actual CI run; no local browser pass is claimed.

## Exact-commit deployment check

Every normal build writes `/build-info.json` with only a schema version, full
Git commit SHA, and clean/dirty state. No environment dumps, tokens, usernames,
local paths, or source contents are included. Cloudflare Pages/GitHub commit
environment values must match checkout HEAD when Git is available. Modified
worktrees and unverifiable cleanliness cannot pass release verification.

After a clean committed release has deployed:

```sh
npm run check:production -- --commit FULL_GIT_SHA --wait-seconds 600
```

The default origin comes from `src/config/site.mjs`. To inspect a preview,
append `--url https://the-preview-origin.example`. The checker requires the
explicit full expected SHA, bypasses normal caches, checks build identity both
before and after public route/feed/sitemap/search smoke checks, and returns a
nonzero status on failure or timeout. An HTTP 200 alone is never considered
proof that the requested commit deployed. The metadata identifies the build;
it is not a cryptographic provenance attestation or a guarantee that every CDN
edge has converged.

The workflow does not change repository branch protection, hosting settings,
access, or deployment permissions. Existing main auto-deploy still uses its
configured build command. To verify browser tests before deployment without
changing those settings, push a `quality/**` branch, wait for Quality on its
exact SHA, then move main to that same tested commit. If main is pushed first,
browser CI and hosting may run concurrently; the normal build's formatting,
unit, tag, type, and generated-output gates still run in the hosting build.

## References

- [Playwright CI setup](https://playwright.dev/docs/ci-intro)
- [Playwright accessibility testing](https://playwright.dev/docs/accessibility-testing)
- [Playwright projects and device emulation](https://playwright.dev/docs/test-projects)
- [Dependency security assessment](./security-dependencies.md)
