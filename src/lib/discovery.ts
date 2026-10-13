import type { BlogPost } from "./content";

// "OSTEP 16 Segmentation", "Real MySQL 8.0 9장 옵티마이저와 힌트": a title prefix
// followed by a chapter number. Problem ids such as "백준 1162번" never match
// because the number must be followed by whitespace (or 장).
const SERIES_TITLE = /^(.*?\S)\s+(\d+)(?:장)?(?=\s)/;
const MIN_SERIES_SIZE = 3;

type SeriesEntry = { key: string; order: number };

function seriesEntry(post: BlogPost): SeriesEntry | undefined {
  const match = post.data.title.match(SERIES_TITLE);
  if (!match) return undefined;
  return {
    key: match[1].replace(/\s+/g, " ").toLowerCase(),
    order: Number(match[2]),
  };
}

/** Posts of the same numbered series, ordered by chapter; empty if none. */
export function getSeries(post: BlogPost, posts: readonly BlogPost[]) {
  const entry = seriesEntry(post);
  if (!entry) return [];
  const members = posts
    .filter((candidate) => !candidate.data.draft)
    .map((candidate) => ({ post: candidate, entry: seriesEntry(candidate) }))
    .filter(
      (candidate): candidate is { post: BlogPost; entry: SeriesEntry } =>
        candidate.entry?.key === entry.key,
    )
    .sort((a, b) => a.entry.order - b.entry.order);
  return members.length >= MIN_SERIES_SIZE
    ? members.map((member) => member.post)
    : [];
}

/**
 * Previous and next reading: neighbouring chapters within a series, otherwise
 * neighbouring posts by date. `posts` is sorted newest first.
 */
export function getNeighbors(post: BlogPost, posts: readonly BlogPost[]) {
  const series = getSeries(post, posts);
  if (series.length > 0) {
    const index = series.findIndex((candidate) => candidate.id === post.id);
    return { previous: series[index - 1], next: series[index + 1] };
  }
  const index = posts.findIndex((candidate) => candidate.id === post.id);
  return { previous: posts[index + 1], next: posts[index - 1] };
}

export function getRelatedPosts(
  post: BlogPost,
  posts: readonly BlogPost[],
  limit = 3,
  excludeIds: readonly string[] = [],
) {
  const excluded = new Set([post.id, ...excludeIds]);
  // Nearby chapters of the same series come first.
  const current = seriesEntry(post);
  const siblings = getSeries(post, posts)
    .filter((candidate) => !excluded.has(candidate.id))
    .sort(
      (a, b) =>
        Math.abs(seriesEntry(a)!.order - current!.order) -
          Math.abs(seriesEntry(b)!.order - current!.order) ||
        seriesEntry(a)!.order - seriesEntry(b)!.order,
    )
    .slice(0, Math.max(0, limit));
  for (const sibling of siblings) excluded.add(sibling.id);
  const tags = new Set(post.data.tags ?? []);
  const broadTags = new Set(["cs", "ps", "life", "job"]);
  const byTopic = posts
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
    .slice(0, Math.max(0, limit - siblings.length))
    .map(({ post: candidate }) => candidate);
  return [...siblings, ...byTopic];
}
