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

  return `${Math.max(1, Math.ceil(wordCount / 200))}분 읽기`;
}
