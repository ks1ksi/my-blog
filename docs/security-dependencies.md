# Dependency security assessment

Reviewed 2026-10-03. This documents residual risk; it does not claim a clean
security audit or a patched dependency.

## GHSA-ch52-4w7c-c8xp

- Advisory: [GHSA-ch52-4w7c-c8xp](https://github.com/advisories/GHSA-ch52-4w7c-c8xp)
- Affected installed package: `http-cache-semantics@4.2.0`, through
  `astro@7.3.5`
- Upstream lists versions through 4.2.0 as affected and no patched version
- Current `npm audit` reports three high-severity dependency entries:
  `http-cache-semantics`, Astro, and MDX's propagated Astro exposure. These
  represent the same underlying advisory, not three independently identified
  vulnerabilities

The advisory concerns cross-user disclosure from shared HTTP caches when a
request's `max-stale` directive interacts with protected cached responses.

### Applicability to this repository

The site is built with `output: "static"`, has no server adapter, authenticated
SSR endpoints, or application response-cache process in the deployed output.
The affected npm implementation is not shipped as a live server behind the
blog. Inspection of the installed Astro source places its use in build-time
remote image cache policy handling
(`node_modules/astro/dist/assets/build/remote.js`). That source creates outbound
image requests; it is not a shared cache serving visitor-controlled authenticated
responses for this static site. This makes the advisory's described cross-user
production attack path inapplicable to the current architecture, based on the
code and deployment model inspected. This is a scoped risk assessment, not a
claim of universal non-exploitability or a review of Cloudflare's own caches.

Build-time dependencies remain part of the supply chain. Do not feed private
or authenticated remote images into shared build caches, introduce a server
adapter, or add an authenticated caching layer without revisiting this
assessment. Prefer local/public content inputs and clean reproducible installs.

### Decision and follow-up

Keep the compatible dependency tree for now. Do not use `npm audit fix --force`:
the proposed Astro 2.x / old MDX downgrade is incompatible with this project and
is not an upstream patch for `http-cache-semantics@4.2.0`. Do not relabel the
advisory as fixed, replace its version with a fictitious override, patch a copy
inside node_modules, or suppress it in audit output.

At dependency maintenance, rerun `npm audit` and `npm ls http-cache-semantics`,
review the upstream advisory, and upgrade the first compatible patched release
when available. Rerun strict `npm ci`, the normal build gates, and browser tests
after updating. Reassess immediately if the deployment stops being purely
static or starts handling private cached responses. CSP and unrelated HTTP
headers do not repair this cache-policy bug; no such policy was added as a
substitute for a fix.
