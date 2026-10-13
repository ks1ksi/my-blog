import type { APIRoute } from "astro";
import { markSvg } from "@lib/brand";
import { pngResponse, renderSvgPng } from "@lib/og";

// iOS rounds the corners itself, so the square fills the whole icon.
const svg = markSvg({ background: "#18181b", foreground: "#fafafa" }).replace(
  'rx="22"',
  'rx="0"',
);

export const GET: APIRoute = () => pngResponse(renderSvgPng(svg, 180));
