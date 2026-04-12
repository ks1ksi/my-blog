import rss from "@astrojs/rss";
import { SITE } from "@consts";
import { getPublishedPosts } from "@lib/content";

export async function GET(context) {
  const items = await getPublishedPosts();

  return rss({
    title: SITE.TITLE,
    description: SITE.DESCRIPTION,
    site: context.site,
    items: items.map((item) => ({
      title: item.data.title,
      description: item.data.description,
      pubDate: item.data.date,
      link: `/${item.collection}/${item.id}/`,
    })),
  });
}
