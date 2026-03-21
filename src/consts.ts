import type { Metadata, Site, Socials } from "@types";

export const SITE: Site = {
  TITLE: "Seungil Kim",
  DESCRIPTION: "Seungil Kim's personal blog",
  EMAIL: "me@ks1ksi.io",
  NUM_POSTS_ON_HOMEPAGE: 5,
};

export const HOME: Metadata = {
  TITLE: "Home",
  DESCRIPTION: "Seungil Kim의 개인 블로그.",
};

export const BLOG: Metadata = {
  TITLE: "Blog",
  DESCRIPTION: "다양한 주제에 대한 글 모음.",
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
