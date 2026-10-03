import type { BlogPost } from "./content";

export const FEATURED_POST_IDS = [
  "real-mysql-80-8장-인덱스",
  "ostep-04-process",
  "그래프-최단경로-알고리즘-정리",
  "토스-3년-이하-server-developer-challenge-지원-및-합격-후기",
] as const;

export function getFeaturedPosts(posts: readonly BlogPost[]) {
  const byId = new Map(
    posts.filter((post) => !post.data.draft).map((post) => [post.id, post]),
  );
  return FEATURED_POST_IDS.flatMap((id) => {
    const post = byId.get(id);
    return post ? [post] : [];
  });
}

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

export function validateDiscoveryReferences(posts: readonly BlogPost[]) {
  const published = new Set(
    posts.filter((post) => !post.data.draft).map((post) => post.id),
  );
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const id of FEATURED_POST_IDS) {
    if (seen.has(id)) errors.push(`대표 글: duplicate post ${id}`);
    if (!published.has(id))
      errors.push(`대표 글: unpublished or missing post ${id}`);
    seen.add(id);
  }
  return errors;
}
