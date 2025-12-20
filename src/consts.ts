import type { Metadata, Site, Socials } from "@types";

export const SITE: Site = {
  TITLE: "Seungil Kim",
  DESCRIPTION: "Seugnil Kim's personal blog",
  EMAIL: "me@seungil.kim",
  NUM_POSTS_ON_HOMEPAGE: 5,
  NUM_PROJECTS_ON_HOMEPAGE: 1,
};

export const HOME: Metadata = {
  TITLE: "Home",
  DESCRIPTION: "Seungil Kim's personal blog.",
};

export const BLOG: Metadata = {
  TITLE: "Blog",
  DESCRIPTION: "A collection of articles on topics I am passionate about.",
};

export const PROJECTS: Metadata = {
  TITLE: "Projects",
  DESCRIPTION:
    "A collection of my projects with links to repositories and live demos.",
};

export const SOCIALS: Socials = [
  {
    NAME: "Email",
    HREF: "mailto:me@seungil.kim",
  },
  {
    NAME: "GitHub",
    HREF: "https://github.com/ks1ksi",
  },
  {
    NAME: "Website",
    HREF: "https://seungil.kim",
  },
];
