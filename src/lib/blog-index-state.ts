import { readPreference, writePreference } from "./client/storage";

const YEAR_STORAGE_KEY = "blog:open-years";

function readStoredYears() {
  try {
    const value = readPreference("session", YEAR_STORAGE_KEY);
    if (!value) {
      return null;
    }

    const years = JSON.parse(value);
    return Array.isArray(years) ? new Set(years.map(String)) : null;
  } catch {
    return null;
  }
}

export function restoreBlogIndexState(root = document) {
  const storedYears = readStoredYears();
  if (!storedYears) return;

  for (const details of root.querySelectorAll<HTMLDetailsElement>(
    "[data-year-details]",
  )) {
    const year = details.dataset.year;
    details.open = Boolean(year && storedYears.has(year));
  }
}

export function initBlogIndexState() {
  restoreBlogIndexState();
  const yearDetails = Array.from(
    document.querySelectorAll<HTMLDetailsElement>("[data-year-details]"),
  );

  const writeStoredYears = () => {
    const openYears = yearDetails
      .filter((details) => details.open)
      .map((details) => details.dataset.year)
      .filter(Boolean);

    writePreference("session", YEAR_STORAGE_KEY, JSON.stringify(openYears));
  };

  yearDetails.forEach((details) => {
    if (details.dataset.yearStateBound === "true") {
      return;
    }

    details.dataset.yearStateBound = "true";
    details.addEventListener("toggle", writeStoredYears);
  });
}
