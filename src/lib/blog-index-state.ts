const YEAR_STORAGE_KEY = "blog:open-years";

function readStoredYears() {
  try {
    const value = sessionStorage.getItem(YEAR_STORAGE_KEY);
    if (!value) {
      return null;
    }

    const years = JSON.parse(value);
    return Array.isArray(years) ? new Set(years.map(String)) : null;
  } catch {
    return null;
  }
}

export function initBlogIndexState() {
  const yearDetails = Array.from(
    document.querySelectorAll<HTMLDetailsElement>("[data-year-details]"),
  );

  if (yearDetails.length === 0) {
    return;
  }

  const storedYears = readStoredYears();
  if (storedYears) {
    yearDetails.forEach((details) => {
      const year = details.dataset.year;
      details.open = Boolean(year && storedYears.has(year));
    });
  }

  const writeStoredYears = () => {
    const openYears = yearDetails
      .filter((details) => details.open)
      .map((details) => details.dataset.year)
      .filter(Boolean);

    sessionStorage.setItem(YEAR_STORAGE_KEY, JSON.stringify(openYears));
  };

  yearDetails.forEach((details) => {
    if (details.dataset.yearStateBound === "true") {
      return;
    }

    details.dataset.yearStateBound = "true";
    details.addEventListener("toggle", writeStoredYears);
  });
}
