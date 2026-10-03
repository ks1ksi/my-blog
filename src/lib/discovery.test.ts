import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseFrontmatter } from "@astrojs/markdown-remark";
import { slug } from "github-slugger";
import { describe, expect, it } from "vitest";
import type { BlogPost } from "./content";
import {
  FEATURED_POST_IDS,
  getFeaturedPosts,
  getRelatedPosts,
  validateDiscoveryReferences,
} from "./discovery";

function post(
  id: string,
  tags: string[] = [],
  date = "2024-01-01",
  draft = false,
): BlogPost {
  return {
    id,
    collection: "blog",
    data: { title: id, date: new Date(date), tags, draft },
  };
}

const contentDir = fileURLToPath(new URL("../content/blog/", import.meta.url));
const actualPosts = readdirSync(contentDir)
  .filter((file) => /\.mdx?$/.test(file))
  .map((file) => {
    const { frontmatter } = parseFrontmatter(
      readFileSync(`${contentDir}/${file}`, "utf8"),
    );
    return {
      id: frontmatter.slug ?? slug(file.replace(/\.mdx?$/, "")),
      collection: "blog" as const,
      data: {
        ...frontmatter,
        title: frontmatter.title,
        date: new Date(frontmatter.date),
      },
    } satisfies BlogPost;
  });

describe("curated content references", () => {
  it("points every curated entry at a unique, published repository post", () => {
    expect(validateDiscoveryReferences(actualPosts)).toEqual([]);
    expect(FEATURED_POST_IDS.length).toBeGreaterThanOrEqual(3);
    expect(FEATURED_POST_IDS.length).toBeLessThanOrEqual(5);
  });
  it("preserves editorial order rather than input or date order", () => {
    const posts = FEATURED_POST_IDS.map((id) => post(id)).reverse();
    expect(getFeaturedPosts(posts).map((entry) => entry.id)).toEqual(
      FEATURED_POST_IDS,
    );
    expect(posts[0].id).toBe(FEATURED_POST_IDS.at(-1));
  });
  it("does not publish missing or draft features and reports stale references", () => {
    expect(
      getFeaturedPosts([post(FEATURED_POST_IDS[0], [], undefined, true)]),
    ).toEqual([]);
    expect(validateDiscoveryReferences([])).toContain(
      `대표 글: unpublished or missing post ${FEATURED_POST_IDS[0]}`,
    );
  });
});

describe("related reading", () => {
  it("ranks a specific shared topic ahead of a newer broad match", () => {
    const current = post("current", ["cs", "db"]);
    const posts = [
      current,
      post("broad", ["cs"], "2025-01-01"),
      post("specific", ["db"], "2023-01-01"),
      post("both", ["cs", "db"], "2022-01-01"),
    ];
    expect(getRelatedPosts(current, posts).map((entry) => entry.id)).toEqual([
      "both",
      "specific",
      "broad",
    ]);
  });
  it("excludes the current post, drafts, navigation duplicates and unrelated content", () => {
    const current = post("current", ["os"]);
    const posts = [
      current,
      post("draft", ["os"], undefined, true),
      post("neighbor", ["os"]),
      post("other", ["job"]),
      post("related", ["os"]),
    ];
    expect(
      getRelatedPosts(current, posts, 3, ["neighbor"]).map((entry) => entry.id),
    ).toEqual(["related"]);
    expect(getRelatedPosts(post("untagged"), posts)).toEqual([]);
    expect(getRelatedPosts(current, posts, 0)).toEqual([]);
  });
  it("breaks ties deterministically and never mutates the collection", () => {
    const current = post("current", ["ps"]);
    const posts = [
      post("z", ["ps"]),
      post("a", ["ps"]),
      post("newest", ["ps"], "2025-01-01"),
    ];
    expect(getRelatedPosts(current, posts, 2).map((entry) => entry.id)).toEqual(
      ["newest", "a"],
    );
    expect(posts.map((entry) => entry.id)).toEqual(["z", "a", "newest"]);
  });
});
