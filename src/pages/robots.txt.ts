import { SITE_URL } from "../config/site.mjs";

export function GET() {
  return new Response(
    `User-agent: *\nAllow: /\n\nSitemap: ${new URL("sitemap-index.xml", SITE_URL).href}\n`,
    { headers: { "Content-Type": "text/plain; charset=utf-8" } },
  );
}
