import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  new URL("../styles/tokens.css", import.meta.url),
  "utf8",
);
const backgrounds = [
  "bg",
  "surface",
  "surface-muted",
  "accent-subtle",
  "accent-active",
];
const textRoles = ["text", "text-strong", "muted", "accent", "visited"];

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((position) => {
    const value = parseInt(hex.slice(position, position + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(left: string, right: string) {
  const values = [luminance(left), luminance(right)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

for (const theme of [":root", ".dark"]) {
  const block = css.slice(css.indexOf(`${theme} {`)).split("}")[0];
  const colors = Object.fromEntries(
    [...block.matchAll(/--color-([\w-]+): (#[a-f\d]{6});/g)].map((match) => [
      match[1],
      match[2],
    ]),
  );
  describe(`${theme} contrast tokens`, () => {
    for (const background of backgrounds) {
      it(`keeps normal text readable on ${background}`, () => {
        for (const role of textRoles) {
          expect(
            contrast(colors[role], colors[background]),
            `${role} on ${background}`,
          ).toBeGreaterThanOrEqual(4.5);
        }
      });
      it(`keeps focus and interactive boundaries visible on ${background}`, () => {
        for (const role of ["focus", "border-strong"]) {
          expect(
            contrast(colors[role], colors[background]),
            `${role} on ${background}`,
          ).toBeGreaterThanOrEqual(3);
        }
      });
    }
  });
}
