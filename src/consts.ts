import type { Metadata, Site, Socials } from "@types";

export const SITE: Site = {
  TITLE: "Seungil Kim",
  DESCRIPTION: "Seungil Kim's personal blog",
  EMAIL: "me@ks1ksi.io",
  NUM_POSTS_ON_HOMEPAGE: 5,
};

export const HOME: Metadata = {
  TITLE: "Home",
  DESCRIPTION: "Seungil Kim's personal blog.",
};

export const BLOG: Metadata = {
  TITLE: "Blog",
  DESCRIPTION: "Posts on software engineering, problem solving, and life.",
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
