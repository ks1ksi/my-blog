import type { APIRoute } from "astro";
import { MARK_PATH, MARK_STROKE_WIDTH } from "@lib/brand";

// Follows the browser theme so the tab icon never disappears into the tab bar.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><style>rect{fill:#18181b}path{stroke:#fafafa}@media (prefers-color-scheme:dark){rect{fill:#fafafa}path{stroke:#18181b}}</style><rect width="100" height="100" rx="22"/><path d="${MARK_PATH}" fill="none" stroke-width="${MARK_STROKE_WIDTH}" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

export const GET: APIRoute = () =>
  new Response(svg, { headers: { "Content-Type": "image/svg+xml" } });
