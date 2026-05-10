import type { BlogPost } from "@lib/content";
import { SITE } from "@consts";

const DESCRIPTION_MAX_LENGTH = 160;
const STOP_SECTION_HEADINGS = new Set(["코드", "여담"]);

function removeFrontmatter(content: string) {
  return content.replace(/^---\s*\n[\s\S]*?\n---\s*/, "");
}

function removeCodeBlocks(content: string) {
  return content.replace(/```[\s\S]*?```/g, " ");
}

function isHeading(block: string) {
  return /^#{1,6}\s+/.test(block.trim());
}

function getHeadingText(block: string) {
  return block
    .trim()
    .replace(/^#{1,6}\s+/, "")
    .replace(/\s+#*$/, "")
    .trim();
}

function isImageOnly(block: string) {
  const value = block.trim();

  return /^!\[\[.+?\]\]$/.test(value) || /^!\[[^\]]*]\([^)]*\)$/.test(value);
}

function normalizeTitle(value: string) {
  return value
    .replace(/^["']|["']$/g, "")
    .replace(/백준\s+(\d+)번/g, "백준 $1")
    .replace(/[:"'()[\]\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function isLinkOnlyBlock(block: string) {
  return block
    .trim()
    .split(/\n+/)
    .every((line) => /^\s*\[[^\]]+]\([^)]*\)\s*\\?\s*$/.test(line));
}

function isStandaloneLinkToTitle(block: string, fallback: string) {
  const value = block.trim().replace(/\\+$/, "").trim();
  const link = value.match(/^\[([^\]]+)]\([^)]*\)$/);
  if (!link) {
    return isLinkOnlyBlock(block);
  }

  if (/^백준\s+\d+번[:\s]/.test(link[1])) {
    return true;
  }

  const linkText = normalizeTitle(link[1]);
  const title = normalizeTitle(fallback);

  return (
    linkText === title ||
    linkText.startsWith(title) ||
    title.startsWith(linkText) ||
    /^백준\s+\d+번:/.test(linkText)
  );
}

function stripMarkdown(content: string) {
  return content
    .replace(/`([^`]*)`/g, "$1")
    .replace(/^import\s.+$/gm, " ")
    .replace(/!\[\[.*?\]\]/g, " ")
    .replace(/\[\[(.*?)(?:\|.*?)?\]\]/g, "$1")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/^#{1,6}\s+/gm, " ")
    .replace(/^>\s?/gm, " ")
    .replace(/^[\s*-]*[-*+]\s+/gm, " ")
    .replace(/^\s*\d+\.\s+/gm, " ")
    .replace(/[*_~#>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getDescriptionCandidates(content: string, fallback: string) {
  const blocks = removeCodeBlocks(removeFrontmatter(content))
    .replace(/^(#{1,6}\s+.+)$/gm, "\n\n$1\n\n")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
  const candidates: string[] = [];

  for (const block of blocks) {
    if (isHeading(block)) {
      if (STOP_SECTION_HEADINGS.has(getHeadingText(block))) {
        break;
      }

      continue;
    }

    if (
      isImageOnly(block) ||
      isStandaloneLinkToTitle(block, fallback) ||
      /^import\s.+$/m.test(block)
    ) {
      continue;
    }

    const text = stripMarkdown(block);
    if (text) {
      candidates.push(text);
    }

    if (candidates.join(" ").length >= DESCRIPTION_MAX_LENGTH) {
      break;
    }
  }

  return candidates.join(" ");
}

function truncateDescription(description: string) {
  if (description.length <= DESCRIPTION_MAX_LENGTH) {
    return description;
  }

  const truncated = description.slice(0, DESCRIPTION_MAX_LENGTH - 3);
  const lastSpace = truncated.lastIndexOf(" ");
  const shouldTrimAtSpace = lastSpace > DESCRIPTION_MAX_LENGTH * 0.6;

  return `${shouldTrimAtSpace ? truncated.slice(0, lastSpace) : truncated}...`;
}

export function createDescription(content: string, fallback: string) {
  const description =
    getDescriptionCandidates(content, fallback) ||
    stripMarkdown(removeCodeBlocks(removeFrontmatter(content)));

  return truncateDescription(description || fallback);
}

export function getPostDescription(post: BlogPost) {
  return post.data.description ?? createDescription(post.body ?? "", post.data.title);
}

export function getCanonicalUrl(pathname: string) {
  const normalizedPath =
    pathname === "/" || pathname.endsWith("/") ? pathname : `${pathname}/`;

  return new URL(normalizedPath, SITE.URL).href;
}

export function createWebsiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE.TITLE,
    url: SITE.URL,
    inLanguage: "ko-KR",
    publisher: {
      "@type": "Person",
      name: SITE.AUTHOR,
      url: SITE.URL,
    },
  };
}

export function createBreadcrumbJsonLd(
  items: {
    name: string;
    url: string;
  }[],
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function createBlogPostingJsonLd({
  post,
  url,
  image,
  description,
}: {
  post: BlogPost;
  url: string;
  image: string;
  description: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.data.title,
    description,
    url,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": url,
    },
    datePublished: post.data.date.toISOString(),
    dateModified: post.data.date.toISOString(),
    author: {
      "@type": "Person",
      name: SITE.AUTHOR,
      url: "https://github.com/ks1ksi",
    },
    publisher: {
      "@type": "Person",
      name: SITE.AUTHOR,
      url: SITE.URL,
    },
    image,
    inLanguage: "ko-KR",
    keywords: post.data.tags,
  };
}
