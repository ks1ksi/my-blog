import { SITE_LOCALE, SITE_TIME_ZONE } from "../config/site.mjs";

const dateFormatter = new Intl.DateTimeFormat(SITE_LOCALE, {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: SITE_TIME_ZONE,
});
const longDateFormatter = new Intl.DateTimeFormat(SITE_LOCALE, {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: SITE_TIME_ZONE,
});
const yearFormatter = new Intl.DateTimeFormat("en", {
  year: "numeric",
  timeZone: SITE_TIME_ZONE,
});

export function formatDate(date: Date) {
  return dateFormatter.format(date);
}

export function formatLongDate(date: Date) {
  return longDateFormatter.format(date);
}

export function getSiteYear(date: Date) {
  return yearFormatter.format(date);
}
