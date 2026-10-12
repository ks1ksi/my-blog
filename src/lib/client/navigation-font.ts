// CSS-connected faces can become unloaded again during Astro's head swap in
// Chromium. Decode a JS-owned face and retain that exact object through swap.
type PreparedFont = {
  face: FontFace;
  source: HTMLStyleElement;
  detach: () => void;
};
const prepared = new WeakMap<Document, PreparedFont>();
let activeFace: FontFace | undefined;

export async function prepareNavigationFont(
  next: Document,
  signal: AbortSignal,
) {
  const source = next.querySelector<HTMLStyleElement>("style[data-page-font]");
  const family = source?.dataset.pageFont;
  const href = next
    .querySelector('link[rel="preload"][as="font"]')
    ?.getAttribute("href");
  const range = source?.textContent?.match(/unicode-range:([^}]+)/)?.[1];
  if (
    !source ||
    !family ||
    !href ||
    !range ||
    signal.aborted ||
    !document.fonts
  )
    return;
  const face = new FontFace(family, `url(${JSON.stringify(href)})`, {
    style: "normal",
    weight: "45 920",
    display: "swap",
    unicodeRange: range,
  });
  // Keep the outgoing page's font and geometry untouched while loading.
  let cancelWait: (ready: boolean) => void = () => {};
  const cancelled = new Promise<boolean>((resolve) => (cancelWait = resolve));
  const detach = () => signal.removeEventListener("abort", discard);
  const discard = () => {
    prepared.delete(next);
    detach();
    cancelWait(false);
  };
  signal.addEventListener("abort", discard, { once: true });
  // Font failure must never trap navigation or leave a hidden screen.
  const timeout = window.setTimeout(() => cancelWait(false), 2000);
  const loaded = await Promise.race([
    face.load().then(
      () => true,
      () => false,
    ),
    cancelled,
  ]);
  window.clearTimeout(timeout);
  if (!loaded || signal.aborted) {
    discard();
    return;
  }
  prepared.set(next, { face, source, detach });
}

export function commitNavigationFont(next: Document) {
  const font = prepared.get(next);
  if (font) {
    font.detach();
    prepared.delete(next);
    document.fonts.add(font.face);
    // Do not register a second, unloaded CSS face over the decoded JS face.
    // The separate stack style still selects this page's unique family.
    font.source.textContent = "";
  }
  if (activeFace) document.fonts.delete(activeFace);
  activeFace = font?.face;
}
