import { clsx, type ClassValue } from "clsx";
import type { Image, Link, Parent, PhrasingContent, Text } from "mdast";
import type { Node } from "unist";
import { visit } from "unist-util-visit";
import { twMerge } from "tailwind-merge";

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date) {
  return dateFormatter.format(date);
}

export function readingTime(content: string) {
  const textOnly = content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[\[.*?\]\]/g, " ")
    .replace(/\[\[(.*?)(?:\|.*?)?\]\]/g, "$1")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const wordCount = textOnly ? textOnly.split(" ").length : 0;

  return `${Math.max(1, Math.ceil(wordCount / 200))} min read`;
}

export function remarkObsidianLink() {
  return (tree: Node) => {
    visit(
      tree,
      "text",
      (node: Text, index: number | undefined, parent: Parent | undefined) => {
      if (!parent || index === undefined) return;

      const regex = /(!?)\[\[(.*?)(?:\|(.*?))?\]\]/g;
      if (!node.value.match(regex)) return;

      const newNodes: PhrasingContent[] = [];
      let lastIndex = 0;

      node.value.replace(regex, (match, isImage, filename, alias, offset) => {
        if (offset > lastIndex) {
          newNodes.push({
            type: "text",
            value: node.value.slice(lastIndex, offset),
          });
        }

        if (isImage === "!") {
          newNodes.push({
            type: "image",
            url: `../images/${filename}`,
            alt: filename,
          } as Image);
        } else {
          const slug = filename.trim().replace(/\s+/g, "-").toLowerCase();
          newNodes.push({
            type: "link",
            url: `/blog/${slug}`,
            children: [
              { type: "text", value: alias || filename },
            ],
          } as Link);
        }

        lastIndex = offset + match.length;
        return match;
      });

      if (lastIndex < node.value.length) {
        newNodes.push({
          type: "text",
          value: node.value.slice(lastIndex),
        });
      }

      parent.children.splice(index, 1, ...newNodes);
      return index + newNodes.length;
    });
  };
}
