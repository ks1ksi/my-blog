type ReturnScrollRoute = {
  key: string | ((pathname: string) => string);
  sourcePattern: RegExp;
  destinationPattern: RegExp;
};

type ReturnScrollIntent = {
  routeKey: string;
  sourcePathname: string;
  destinationPathname: string;
  scrollY: number;
};

const RETURN_SCROLL_INTENT_STORAGE_KEY = "return-scroll:intent";
const LEGACY_PREVIOUS_PATH_STORAGE_KEY = "navigation:previous-path";
const RETURN_SCROLL_ROUTES: ReturnScrollRoute[] = [
  {
    key: "blog",
    sourcePattern: /^\/blog$/,
    destinationPattern: /^\/blog\/.+/,
  },
  {
    key: "tags",
    sourcePattern: /^\/tags$/,
    destinationPattern: /^\/tags\/[^/]+$/,
  },
  {
    key: (pathname) => `tag:${pathname}`,
    sourcePattern: /^\/tags\/[^/]+$/,
    destinationPattern: /^\/blog\/.+/,
  },
];

let saveScheduled = false;

export function normalizePathname(pathname = window.location.pathname) {
  const normalizedPathname = pathname.replace(/\/$/, "");
  return normalizedPathname || "/";
}

function getRoute(pathname = window.location.pathname) {
  const normalizedPathname = normalizePathname(pathname);

  return RETURN_SCROLL_ROUTES.find((route) =>
    route.sourcePattern.test(normalizedPathname),
  );
}

function getRouteKey(
  route: ReturnScrollRoute,
  pathname = window.location.pathname,
) {
  const normalizedPathname = normalizePathname(pathname);
  return typeof route.key === "function"
    ? route.key(normalizedPathname)
    : route.key;
}

function getStorageKey(routeKey: string) {
  return `return-scroll:${routeKey}:position`;
}

function readReturnScrollIntent() {
  const serializedIntent = sessionStorage.getItem(
    RETURN_SCROLL_INTENT_STORAGE_KEY,
  );
  if (!serializedIntent) {
    return null;
  }

  try {
    const intent = JSON.parse(serializedIntent) as Partial<ReturnScrollIntent>;
    if (
      typeof intent.routeKey !== "string" ||
      typeof intent.sourcePathname !== "string" ||
      typeof intent.destinationPathname !== "string" ||
      typeof intent.scrollY !== "number" ||
      !Number.isFinite(intent.scrollY) ||
      intent.scrollY <= 0
    ) {
      return null;
    }

    return intent as ReturnScrollIntent;
  } catch {
    return null;
  }
}

function clearReturnScrollIntent() {
  sessionStorage.removeItem(RETURN_SCROLL_INTENT_STORAGE_KEY);
  sessionStorage.removeItem(LEGACY_PREVIOUS_PATH_STORAGE_KEY);
}

function writeCurrentScrollPosition(
  route: ReturnScrollRoute,
  pathname = window.location.pathname,
) {
  const routeKey = getRouteKey(route, pathname);
  sessionStorage.setItem(getStorageKey(routeKey), String(window.scrollY));
}

function writeReturnScrollIntent(
  route: ReturnScrollRoute,
  sourcePathname = window.location.pathname,
  destinationPathname: string,
) {
  const routeKey = getRouteKey(route, sourcePathname);
  const scrollY = window.scrollY;
  const intent: ReturnScrollIntent = {
    routeKey,
    sourcePathname: normalizePathname(sourcePathname),
    destinationPathname: normalizePathname(destinationPathname),
    scrollY,
  };

  sessionStorage.setItem(getStorageKey(routeKey), String(scrollY));
  sessionStorage.setItem(
    RETURN_SCROLL_INTENT_STORAGE_KEY,
    JSON.stringify(intent),
  );
}

export function saveCurrentReturnScrollPosition(
  pathname = window.location.pathname,
) {
  const route = getRoute(pathname);
  if (!route) return;

  writeCurrentScrollPosition(route, pathname);
}

function getNavigationFromPathname(event?: Event) {
  return event && "from" in event && event.from instanceof URL
    ? event.from.pathname
    : window.location.pathname;
}

function getNavigationToPathname(event?: Event) {
  return event && "to" in event && event.to instanceof URL
    ? event.to.pathname
    : null;
}

export function rememberNavigationSource(event?: Event) {
  const fromPathname = getNavigationFromPathname(event);
  const normalizedFromPathname = normalizePathname(fromPathname);
  const toPathname = getNavigationToPathname(event);
  const normalizedToPathname = toPathname
    ? normalizePathname(toPathname)
    : null;
  const intent = readReturnScrollIntent();
  const route = getRoute(fromPathname);

  if (
    intent &&
    normalizedToPathname &&
    (normalizedFromPathname === intent.sourcePathname ||
      (normalizedFromPathname === intent.destinationPathname &&
        normalizedToPathname !== intent.sourcePathname))
  ) {
    clearReturnScrollIntent();
  }

  if (!route) {
    return;
  }

  if (
    normalizedToPathname &&
    route.destinationPattern.test(normalizedToPathname)
  ) {
    writeReturnScrollIntent(route, fromPathname, normalizedToPathname);
    return;
  }

  saveCurrentReturnScrollPosition(fromPathname);
}

export function rememberReturnScrollIntentFromClick(event: MouseEvent) {
  if (
    event.defaultPrevented ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey
  ) {
    return;
  }

  const target =
    event.target instanceof Element
      ? event.target
      : event.target instanceof Text
        ? event.target.parentElement
        : null;
  const link = target?.closest("a");
  if (!link?.href || link.target || link.hasAttribute("download")) {
    return;
  }

  const url = new URL(link.href);
  if (url.origin !== window.location.origin) {
    return;
  }

  const route = getRoute();
  if (
    !route ||
    !route.destinationPattern.test(normalizePathname(url.pathname))
  ) {
    return;
  }

  writeReturnScrollIntent(route, window.location.pathname, url.pathname);
}

export function scheduleReturnScrollPositionSave() {
  if (!getRoute() || saveScheduled) {
    return;
  }

  saveScheduled = true;
  window.requestAnimationFrame(() => {
    saveScheduled = false;
    saveCurrentReturnScrollPosition();
  });
}

export function restoreReturnScrollPosition() {
  const route = getRoute();
  const intent = readReturnScrollIntent();
  if (!route || !intent) {
    return false;
  }

  const currentPathname = normalizePathname();
  if (
    intent.routeKey !== getRouteKey(route) ||
    intent.sourcePathname !== currentPathname ||
    !route.destinationPattern.test(intent.destinationPathname)
  ) {
    return false;
  }

  clearReturnScrollIntent();

  const restore = () => window.scrollTo(0, intent.scrollY);
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      restore();
      window.setTimeout(restore, 50);
    });
  });

  return true;
}
