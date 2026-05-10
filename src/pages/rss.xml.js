import rss from "@astrojs/rss";
import { render } from "astro:content";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { SITE } from "@consts";
import { getPublishedPosts } from "@lib/content";

const RSS_ITEM_LIMIT = 50;
const XML_INVALID_CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

function absolutizeRootRelativeUrls(html, site) {
  return html.replace(/\s(href|src)="\/(?!\/)([^"]*)"/g, (_match, attr, path) => {
    const absoluteUrl = new URL(`/${path}`, site).href;
    return ` ${attr}="${absoluteUrl}"`;
  });
}

function sanitizeXmlText(value) {
  return value?.replace(XML_INVALID_CONTROL_CHARS, "") ?? value;
}

export async function GET(context) {
  const items = (await getPublishedPosts()).slice(0, RSS_ITEM_LIMIT);
  const container = await AstroContainer.create();
  const rssItems = await Promise.all(
    items.map(async (item) => {
      const { Content } = await render(item);
      const content = absolutizeRootRelativeUrls(
        await container.renderToString(Content),
        context.site,
      );

      return {
        title: sanitizeXmlText(item.data.title),
        description: sanitizeXmlText(item.data.description),
        content: sanitizeXmlText(content),
        pubDate: item.data.date,
        link: `/${item.collection}/${item.id}/`,
        categories: item.data.tags?.map(sanitizeXmlText),
      };
    }),
  );

  return rss({
    title: SITE.TITLE,
    description: SITE.DESCRIPTION,
    site: context.site,
    trailingSlash: true,
    items: rssItems,
  });
}
