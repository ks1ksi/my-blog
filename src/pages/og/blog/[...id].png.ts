import type { APIRoute, GetStaticPaths } from "astro";
import { SITE } from "@consts";
import { formatLongDate } from "@lib/dates";
import { type BlogPost, getPublishedPosts } from "@lib/content";
import { brandLockup, h, ogCanvas, pngResponse, renderOgPng } from "@lib/og";

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

function renderOgImage(post: BlogPost) {
  const title = formatTitleForImage(post.data.title);
  const tags = getTagLabel(post.data.tags);

  return renderOgPng(
    ogCanvas(
      "64px 80px 60px",
      h(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          },
        },
        brandLockup(52, 34),
        h(
          "div",
          {
            style: {
              display: "flex",
              color: "rgba(250,250,250,0.6)",
              fontSize: 26,
            },
          },
          new URL(SITE.URL).hostname,
        ),
      ),
      h(
        "div",
        {
          style: { display: "flex", flexDirection: "column", width: "1000px" },
        },
        h(
          "div",
          {
            style: {
              display: "flex",
              fontSize: getTitleFontSize(title),
              fontWeight: 700,
              lineHeight: 1.12,
              letterSpacing: "-0.02em",
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
              marginTop: 28,
              color: "rgba(250,250,250,0.6)",
              fontSize: 28,
            },
          },
          formatLongDate(post.data.date),
        ),
      ),
      h(
        "div",
        {
          style: {
            display: "flex",
            gap: 20,
            color: "#9dbbe3",
            fontSize: 26,
            fontWeight: 700,
          },
        },
        ...(tags.length > 0 ? tags : ["blog"]).map((tag) =>
          h("div", { style: { display: "flex" } }, tag),
        ),
      ),
    ),
  );
}

export const getStaticPaths: GetStaticPaths = async () => {
  const posts = await getPublishedPosts();

  return posts.map((post) => ({
    params: { id: post.id },
    props: { post },
  }));
};

export const GET: APIRoute<{ post: BlogPost }> = async ({ props }) => {
  return pngResponse(await renderOgImage(props.post));
};
