import type { BlogPost } from "./content";

export function getRelatedPosts(
  post: BlogPost,
  posts: readonly BlogPost[],
  limit = 3,
  excludeIds: readonly string[] = [],
) {
  const excluded = new Set([post.id, ...excludeIds]);
  const tags = new Set(post.data.tags ?? []);
  const broadTags = new Set(["cs", "ps", "life", "job"]);
  return posts
    .filter((candidate) => !candidate.data.draft && !excluded.has(candidate.id))
    .map((candidate) => ({
      post: candidate,
      score: [...new Set(candidate.data.tags ?? [])].reduce(
        (score, tag) =>
          score + (tags.has(tag) ? (broadTags.has(tag) ? 1 : 3) : 0),
        0,
      ),
    }))
    .filter(({ score }) => score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.post.data.date.valueOf() - a.post.data.date.valueOf() ||
        a.post.id.localeCompare(b.post.id, "ko-KR"),
    )
    .slice(0, Math.max(0, limit))
    .map(({ post: candidate }) => candidate);
}
