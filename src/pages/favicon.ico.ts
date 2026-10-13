import type { APIRoute } from "astro";
import { markSvg } from "@lib/brand";
import { renderSvgPng } from "@lib/og";

const SIZES = [16, 32, 48];

// An ICO file whose entries are PNGs, for clients that only ask for /favicon.ico.
function icoFromPngs(images: { size: number; png: Uint8Array }[]) {
  const header = Buffer.alloc(6 + images.length * 16);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  let offset = header.length;
  images.forEach(({ size, png }, index) => {
    const entry = 6 + index * 16;
    header.writeUInt8(size, entry);
    header.writeUInt8(size, entry + 1);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(png.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  });

  return Buffer.concat([header, ...images.map(({ png }) => png)]);
}

export const GET: APIRoute = () => {
  const svg = markSvg({ background: "#18181b", foreground: "#fafafa" });
  const ico = icoFromPngs(
    SIZES.map((size) => ({ size, png: renderSvgPng(svg, size) })),
  );

  return new Response(new Uint8Array(ico), {
    headers: { "Content-Type": "image/x-icon" },
  });
};
