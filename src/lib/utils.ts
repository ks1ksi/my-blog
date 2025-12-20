import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date) {
  return Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function readingTime(html: string) {
  const textOnly = html.replace(/<[^>]+>/g, "");
  const wordCount = textOnly.split(/\s+/).length;
  const readingTimeMinutes = (wordCount / 200 + 1).toFixed();
  return `${readingTimeMinutes} min read`;
}

import { visit } from "unist-util-visit";
import type { Text, Image, Link, Parent, PhrasingContent } from "mdast";
import type { Node } from "unist";

export function remarkObsidianLink() {
  // Transformer 함수 반환
  return (tree: Node) => {
    // visit 함수에 제네릭이나 타입 단언을 사용하여 node와 parent 타입을 명시
    visit(tree, "text", (node: Text, index: number | undefined, parent: Parent | undefined) => {
      // 부모가 없거나 인덱스가 없으면 스킵 (Type Guard)
      if (!parent || index === undefined) return;

      // 정규식: [[파일명]] 또는 ![[이미지]]
      const regex = /(!?)\[\[(.*?)(?:\|(.*?))?\]\]/g;

      // 매칭되는 게 없으면 빠른 리턴
      if (!node.value.match(regex)) return;

      const newNodes: PhrasingContent[] = [];
      let lastIndex = 0;

      // replace를 사용하여 매칭 지점을 순회
      node.value.replace(regex, (match, isImage, filename, alias, offset) => {
        // 1. 앞부분 텍스트 처리
        if (offset > lastIndex) {
          newNodes.push({
            type: "text",
            value: node.value.slice(lastIndex, offset),
          });
        }

        // 2. 변환 로직
        if (isImage === "!") {
          // 이미지 (![[image.png]]) -> (../images/image.png)
          newNodes.push({
            type: "image",
            url: `../images/${filename}`, // 님 폴더 구조(../images)
            alt: filename,
          } as Image);
        } else {
          // 텍스트 링크 ([[Note]]) -> (/blog/note)
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
        return match; // replace 함수 요구사항 충족
      });

      // 3. 뒷부분 텍스트 처리
      if (lastIndex < node.value.length) {
        newNodes.push({
          type: "text",
          value: node.value.slice(lastIndex),
        });
      }

      // 4. 노드 교체 (splice 타입 문제 해결을 위해 any 혹은 정확한 타입핑 필요)
      parent.children.splice(index, 1, ...newNodes);

      // visit 함수는 변경된 노드의 개수만큼 인덱스를 건너뛰어야 함
      return index + newNodes.length;
    });
  };
}
