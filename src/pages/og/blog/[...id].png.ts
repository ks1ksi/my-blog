import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import type { APIRoute, GetStaticPaths } from "astro";
import satori from "satori";
import { SITE } from "@consts";
import { type BlogPost, getPublishedPosts } from "@lib/content";

const WIDTH = 1200;
const HEIGHT = 630;
const BASE_IMAGE_PATH = join(process.cwd(), "public/og.jpg");
const FONT_REGULAR_PATH = join(
  process.cwd(),
  "node_modules/pretendard/dist/public/static/alternative/Pretendard-Regular.ttf",
);
const FONT_BOLD_PATH = join(
  process.cwd(),
  "node_modules/pretendard/dist/public/static/alternative/Pretendard-Bold.ttf",
);
const assetPromise = Promise.all([
  readFile(BASE_IMAGE_PATH),
  readFile(FONT_REGULAR_PATH),
  readFile(FONT_BOLD_PATH),
]);

type ElementProps = Record<string, unknown>;

function h(type: string, props: ElementProps = {}, ...children: unknown[]) {
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

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Seoul",
  }).format(date);
}

function getTitleFontSize(title: string) {
  if (title.length <= 20) {
    return 76;
  }

  if (title.length <= 44) {
    return 66;
  }

  if (title.length <= 64) {
    return 56;
  }

  return 48;
}

function truncateTitle(title: string) {
  return title.length > 92 ? `${title.slice(0, 89)}...` : title;
}

function formatTitleForImage(title: string) {
  return truncateTitle(title).replace(/([A-Za-z0-9])-([A-Za-z0-9])/g, "$1‑$2");
}

function getTagLabel(tags: string[] = []) {
  return tags.slice(0, 4).map((tag) => `#${tag}`);
}

async function renderOgImage(post: BlogPost) {
  const [baseImage, regularFont, boldFont] = await assetPromise;
  const title = formatTitleForImage(post.data.title);
  const tags = getTagLabel(post.data.tags);
  const titleFontSize = getTitleFontSize(title);
  const backgroundImage = `data:image/jpeg;base64,${baseImage.toString("base64")}`;

  const svg = await satori(
    h(
      "div",
      {
        style: {
          position: "relative",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: `${WIDTH}px`,
          height: `${HEIGHT}px`,
          overflow: "hidden",
          backgroundColor: "#09090b",
          color: "#ffffff",
          fontFamily: "Pretendard",
        },
      },
      h("img", {
        src: backgroundImage,
        width: WIDTH,
        height: HEIGHT,
        style: {
          position: "absolute",
          left: 0,
          top: 0,
          width: `${WIDTH}px`,
          height: `${HEIGHT}px`,
          objectFit: "cover",
          opacity: 0.8,
        },
      }),
      h("div", {
        style: {
          position: "absolute",
          left: 0,
          top: 0,
          width: `${WIDTH}px`,
          height: `${HEIGHT}px`,
          background:
            "linear-gradient(90deg, rgba(2,6,23,0.92) 0%, rgba(2,6,23,0.76) 52%, rgba(2,6,23,0.48) 100%)",
        },
      }),
      h(
        "div",
        {
          style: {
            position: "relative",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "100%",
            height: "100%",
            padding: "72px 86px 64px",
          },
        },
        h(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              color: "rgba(255,255,255,0.78)",
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: 0,
            },
          },
          h("div", { style: { display: "flex" } }, SITE.TITLE),
          h("div", { style: { display: "flex" } }, "ks1ksi.io"),
        ),
        h(
          "div",
          {
            style: {
              display: "flex",
              flexDirection: "column",
              width: "1000px",
            },
          },
          h(
            "div",
            {
              style: {
                display: "flex",
                color: "#ffffff",
                fontSize: titleFontSize,
                fontWeight: 700,
                lineHeight: 1.08,
                letterSpacing: 0,
                wordBreak: "keep-all",
                overflowWrap: "break-word",
              },
            },
            title,
          ),
          h(
            "div",
            {
              style: {
                display: "flex",
                marginTop: 30,
                color: "rgba(255,255,255,0.72)",
                fontSize: 28,
                fontWeight: 400,
              },
            },
            formatDate(post.data.date),
          ),
        ),
        h(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              color: "rgba(255,255,255,0.82)",
              fontSize: 26,
              fontWeight: 600,
            },
          },
          tags.length > 0 ? tags.join("  ") : "blog",
        ),
      ),
    ),
    {
      width: WIDTH,
      height: HEIGHT,
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
    },
  );

  return new Resvg(svg, {
    fitTo: {
      mode: "original",
    },
    background: "rgba(0,0,0,0)",
    logLevel: "error",
  })
    .render()
    .asPng();
}

export const getStaticPaths: GetStaticPaths = async () => {
  const posts = await getPublishedPosts();

  return posts.map((post) => ({
    params: { id: post.id },
    props: { post },
  }));
};

export const GET: APIRoute<{ post: BlogPost }> = async ({ props }) => {
  const png = await renderOgImage(props.post);

  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=3600",
    },
  });
};
