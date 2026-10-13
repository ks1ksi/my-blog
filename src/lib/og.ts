import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import satori from "satori";
import { BRAND_HANDLE, markSvg } from "@lib/brand";

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;
export const OG_BACKGROUND = "#0f0f10";
export const OG_FOREGROUND = "#fafafa";

const FONT_DIR = join(
  process.cwd(),
  "node_modules/pretendard/dist/public/static/alternative",
);
const fontPromise = Promise.all([
  readFile(join(FONT_DIR, "Pretendard-Regular.ttf")),
  readFile(join(FONT_DIR, "Pretendard-Bold.ttf")),
]);

type ElementProps = Record<string, unknown>;

export function h(
  type: string,
  props: ElementProps = {},
  ...children: unknown[]
) {
  return {
    type,
    props:
      children.length === 0
        ? props
        : {
            ...props,
            children: children.length === 1 ? children[0] : children,
          },
  };
}

export function svgDataUri(svg: string) {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

/** The mark and handle, as they sit in the site header. */
export function brandLockup(markSize: number, fontSize: number) {
  return h(
    "div",
    {
      style: {
        display: "flex",
        alignItems: "center",
        gap: Math.round(markSize * 0.36),
        color: OG_FOREGROUND,
        fontSize,
        fontWeight: 700,
        letterSpacing: "-0.02em",
      },
    },
    h("img", {
      src: svgDataUri(
        markSvg({ background: OG_FOREGROUND, foreground: OG_BACKGROUND }),
      ),
      width: markSize,
      height: markSize,
    }),
    h("div", { style: { display: "flex" } }, BRAND_HANDLE),
  );
}

/** Full-bleed card with the shared background, laid out as a column. */
export function ogCanvas(padding: string, ...children: unknown[]) {
  return h(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        width: `${OG_WIDTH}px`,
        height: `${OG_HEIGHT}px`,
        padding,
        backgroundColor: OG_BACKGROUND,
        backgroundImage:
          "radial-gradient(circle at 100% 0%, rgba(40,75,122,0.42) 0%, rgba(15,15,16,0) 58%)",
        color: OG_FOREGROUND,
        fontFamily: "Pretendard",
      },
    },
    ...children,
  );
}

export async function renderOgPng(element: unknown) {
  const [regularFont, boldFont] = await fontPromise;
  const svg = await satori(element as Parameters<typeof satori>[0], {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    fonts: [
      {
        name: "Pretendard",
        data: regularFont,
        weight: 400,
        style: "normal",
        lang: "ko-KR",
      },
      {
        name: "Pretendard",
        data: boldFont,
        weight: 700,
        style: "normal",
        lang: "ko-KR",
      },
    ],
  });

  return renderSvgPng(svg);
}

export function renderSvgPng(svg: string, width?: number) {
  return new Resvg(svg, {
    fitTo: width ? { mode: "width", value: width } : { mode: "original" },
    logLevel: "error",
  })
    .render()
    .asPng();
}

export function pngResponse(png: Uint8Array) {
  return new Response(new Uint8Array(png), {
    headers: { "Content-Type": "image/png" },
  });
}
