import type { Metadata, Site, Socials } from "@types";

export const SITE: Site = {
  TITLE: "Seungil Kim",
  DESCRIPTION:
    "Seungil Kim의 소프트웨어 엔지니어링, 알고리즘 문제 풀이, CS, 커리어 기록을 모은 개인 블로그.",
  URL: "https://ks1ksi.io/",
  AUTHOR: "Seungil Kim",
  EMAIL: "me@ks1ksi.io",
  NUM_POSTS_ON_HOMEPAGE: 5,
};

export const HOME: Metadata = {
  TITLE: SITE.TITLE,
  DESCRIPTION: SITE.DESCRIPTION,
};

export const BLOG: Metadata = {
  TITLE: "Blog",
  DESCRIPTION:
    "Seungil Kim의 소프트웨어 엔지니어링, 알고리즘 문제 풀이, CS, 커리어 관련 글 목록.",
};

export const SOCIALS: Socials = [
  {
    NAME: "GitHub",
    HREF: "https://github.com/ks1ksi",
  },
  {
    NAME: "LinkedIn",
    HREF: "https://www.linkedin.com/in/ks1ksi/",
  },
];
