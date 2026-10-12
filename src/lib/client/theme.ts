import { readPreference, writePreference } from "./storage";

type ThemePreference = "light" | "dark" | "system";
const THEME_STORAGE_KEY = "theme";

function getStoredTheme(): ThemePreference {
  const theme = readPreference("local", THEME_STORAGE_KEY);
  return theme === "light" || theme === "dark" ? theme : "system";
}

function shouldUseDarkTheme(theme = getStoredTheme()) {
  return (
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches)
  );
}

function syncGiscusTheme() {
  const frame = document.querySelector<HTMLIFrameElement>(".giscus-frame");
  const theme = document.documentElement.classList.contains("dark")
    ? "dark"
    : "light";
  frame?.contentWindow?.postMessage(
    { giscus: { setConfig: { theme } } },
    "https://giscus.app",
  );
}

function applyTheme(dark: boolean, target: Document = document) {
  target.documentElement.classList.toggle("dark", dark);
  if (target === document) syncGiscusTheme();
}

function updateThemeControl(target: Document = document) {
  const theme = getStoredTheme();
  for (const button of target.querySelectorAll<HTMLButtonElement>(
    "[data-theme-value]",
  )) {
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.themeValue === theme),
    );
  }
}

export function initializeTheme() {
  prepareTheme(document);
}

export function prepareTheme(target: Document) {
  applyTheme(shouldUseDarkTheme(), target);
  updateThemeControl(target);
}

export function selectTheme(button: HTMLButtonElement) {
  const theme = button.dataset.themeValue;
  if (theme !== "light" && theme !== "dark" && theme !== "system") return;

  writePreference("local", THEME_STORAGE_KEY, theme);
  applyTheme(shouldUseDarkTheme(theme));
  updateThemeControl();
  document.querySelector<HTMLElement>("#theme-picker")?.hidePopover();
  document.querySelector<HTMLButtonElement>("#theme-toggle")?.focus();
}

export function handleSystemThemeChange(event: MediaQueryListEvent) {
  if (getStoredTheme() !== "system") return;
  applyTheme(event.matches);
  updateThemeControl();
}
