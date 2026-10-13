// The ks1ksi mark: a "k" whose stem carries the flag of a "1".
// Shared by the header, favicons and Open Graph images.
export const BRAND_HANDLE = "ks1ksi";
export const MARK_PATH =
  "M30.5 25.5 L40 19 V81 M40 59 L68 33 M50.5 49.5 L70 81";
export const MARK_STROKE_WIDTH = 10.5;

/** Mark on a rounded square, as standalone SVG markup. */
export function markSvg({
  background,
  foreground,
  size = 100,
  strokeWidth = MARK_STROKE_WIDTH,
}: {
  background: string;
  foreground: string;
  size?: number;
  strokeWidth?: number;
}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100"><rect width="100" height="100" rx="22" fill="${background}"/><path d="${MARK_PATH}" fill="none" stroke="${foreground}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
