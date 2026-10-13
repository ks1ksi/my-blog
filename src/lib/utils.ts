import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export { formatDate } from "./dates";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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

  return `${Math.max(1, Math.ceil(wordCount / 200))}분 분량`;
}

const LABEL_SENTENCE = /(정리|풀이|후기|기록|회고|목표)$/;

/**
 * Card summary without the leading sentence that only restates the title,
 * e.g. "2023 회고. 교육봉사, …" → "교육봉사, …". The full description is
 * still used for search engines and social previews.
 */
export function cardSummary(description: string, title: string) {
  const end = description.indexOf(". ");
  if (end < 0) return description;
  const first = description.slice(0, end).replace(/\s+/g, " ").trim();
  const rest = description.slice(end + 2).trim();
  const normalizedTitle = title.replace(/\s+/g, " ").trim();
  if (!rest) return description;
  return first.startsWith(normalizedTitle) || LABEL_SENTENCE.test(first)
    ? rest
    : description;
}
