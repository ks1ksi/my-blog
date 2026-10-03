// Mobile keyboards can resize/pan the visual viewport without changing dvh.
// Keep this subscription scoped to an open dialog; CSS handles the fallback.
export function trackSearchViewport(dialog: HTMLDialogElement) {
  const viewport = window.visualViewport;
  if (!viewport) return () => {};

  const update = () => {
    dialog.style.setProperty(
      "--search-viewport-height",
      `${viewport.height}px`,
    );
    dialog.style.setProperty(
      "--search-viewport-top",
      `${Math.max(0, viewport.offsetTop)}px`,
    );
  };

  update();
  viewport.addEventListener("resize", update);
  viewport.addEventListener("scroll", update);

  return () => {
    viewport.removeEventListener("resize", update);
    viewport.removeEventListener("scroll", update);
    dialog.style.removeProperty("--search-viewport-height");
    dialog.style.removeProperty("--search-viewport-top");
  };
}
