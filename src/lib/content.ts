import { type CollectionEntry, getCollection } from "astro:content";

export type BlogPost = CollectionEntry<"blog">;

export type PostsByYear = {
  year: string;
  posts: BlogPost[];
};

export type TagWithPosts = {
  tag: string;
  count: number;
  posts: BlogPost[];
};

function sortPostsByDate(posts: BlogPost[]) {
  return posts.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

export async function getPublishedPosts() {
  return sortPostsByDate(
    await getCollection("blog", ({ data }) => !data.draft),
  );
}

export async function getRecentPosts(limit: number) {
  return (await getPublishedPosts()).slice(0, limit);
}

export async function getPostsGroupedByYear() {
  const posts = await getPublishedPosts();
  const postsByYear = new Map<string, BlogPost[]>();

  for (const post of posts) {
    const year = post.data.date.getFullYear().toString();
    const yearPosts = postsByYear.get(year) ?? [];
    yearPosts.push(post);
    postsByYear.set(year, yearPosts);
  }

  return [...postsByYear.entries()]
    .sort(([leftYear], [rightYear]) => Number(rightYear) - Number(leftYear))
    .map(([year, groupedPosts]) => ({
      year,
      posts: groupedPosts,
    })) satisfies PostsByYear[];
}

export async function getTagsWithPosts() {
  const posts = await getPublishedPosts();
  const tags = new Map<string, BlogPost[]>();

  for (const post of posts) {
    for (const tag of post.data.tags ?? []) {
      const taggedPosts = tags.get(tag) ?? [];
      taggedPosts.push(post);
      tags.set(tag, taggedPosts);
    }
  }

  return [...tags.entries()]
    .sort(([leftTag], [rightTag]) => leftTag.localeCompare(rightTag, "ko-KR"))
    .map(([tag, taggedPosts]) => ({
      tag,
      count: taggedPosts.length,
      posts: taggedPosts,
    })) satisfies TagWithPosts[];
}
