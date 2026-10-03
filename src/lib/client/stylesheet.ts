type StylesheetLoad = {
  element: HTMLLinkElement;
  promise: Promise<void>;
  cancel: () => void;
};

const pendingStyles = new Map<string, StylesheetLoad>();

export function ensureStylesheet(id: string, href: string) {
  const existing = document.getElementById(id);
  const pending = pendingStyles.get(id);
  if (pending) {
    if (pending.element === existing && pending.element.isConnected) {
      return pending.promise;
    }
    // Astro can remove a dynamically inserted head link during a page swap.
    // A cached promise is valid only while its actual element is still present.
    pending.cancel();
  }

  if (existing && !(existing instanceof HTMLLinkElement)) {
    return Promise.reject(new Error(`Invalid stylesheet element: ${id}`));
  }
  if (existing?.sheet) return Promise.resolve();

  const stylesheet = existing ?? document.createElement("link");
  stylesheet.id = id;
  stylesheet.rel = "stylesheet";
  stylesheet.href = href;
  let cancel = () => {};
  const promise = new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      window.clearTimeout(timer);
      stylesheet.removeEventListener("load", onLoad);
      stylesheet.removeEventListener("error", onError);
      if (pendingStyles.get(id)?.element === stylesheet)
        pendingStyles.delete(id);
    };
    const onLoad = () => {
      cleanup();
      resolve();
    };
    const fail = (message: string) => {
      cleanup();
      stylesheet.remove();
      reject(new Error(message));
    };
    const onError = () => fail("Failed to load search styles");
    cancel = () => fail("Search stylesheet was removed during navigation");
    const timer = window.setTimeout(
      () => fail("Search styles timed out"),
      15000,
    );
    stylesheet.addEventListener("load", onLoad);
    stylesheet.addEventListener("error", onError);
  });
  pendingStyles.set(id, { element: stylesheet, promise, cancel });
  if (!stylesheet.isConnected) document.head.appendChild(stylesheet);
  return promise;
}
