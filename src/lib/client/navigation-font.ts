// Astro preloads stylesheets, but page-specific font faces also need decoding
// before it captures the new view and restores a scrolled history entry.
const prepared = new WeakMap<Document, () => void>();

export async function prepareNavigationFont(
  next: Document,
  signal: AbortSignal,
) {
  const source = next.querySelector<HTMLStyleElement>("style[data-page-font]");
  const family = source?.dataset.pageFont;
  if (!source || !family || signal.aborted || !document.fonts) return;
  const existing = [...document.querySelectorAll("style[data-page-font]")].find(
    (style) => style.textContent === source.textContent,
  );

  // This style contains only @font-face. The separate font stack is applied
  // by the normal head swap, so the outgoing page stays completely unchanged.
  const style = existing ?? (source.cloneNode(true) as HTMLStyleElement);
  if (!existing) document.head.append(style);
  let cancelWait: (ready: boolean) => void = () => {};
  const cancelled = new Promise<boolean>((resolve) => (cancelWait = resolve));
  const discard = () => {
    if (!existing) style.remove();
    prepared.delete(next);
    signal.removeEventListener("abort", discard);
    cancelWait(false);
  };
  signal.addEventListener("abort", discard, { once: true });
  // A failed font must not leave navigation waiting or the screen hidden.
  const timeout = window.setTimeout(() => cancelWait(false), 2000);
  const loaded = await Promise.race([
    document.fonts.load(`16px ${JSON.stringify(family)}`, "A").then(
      (faces) => faces.length > 0,
      () => false,
    ),
    cancelled,
  ]);
  window.clearTimeout(timeout);
  if (!loaded || signal.aborted) {
    discard();
    return;
  }
  prepared.set(next, () => signal.removeEventListener("abort", discard));
}

export function commitNavigationFont(next: Document) {
  // Astro keeps identical head styles, retaining the already decoded face.
  // Stop abort cleanup once that style belongs to the newly displayed page.
  prepared.get(next)?.();
  prepared.delete(next);
}
