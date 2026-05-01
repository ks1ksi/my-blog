type ReturnScrollRoute = {
  key: string | ((pathname: string) => string);
  sourcePattern: RegExp;
  destinationPattern: RegExp;
};

const PREVIOUS_PATH_STORAGE_KEY = "navigation:previous-path";
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

function getPendingKey(routeKey: string) {
  return `return-scroll:${routeKey}:pending`;
}

function getPendingPositionKey(routeKey: string) {
  return `return-scroll:${routeKey}:pending-position`;
}

function hasPendingRestore(route: ReturnScrollRoute) {
  return sessionStorage.getItem(getPendingKey(getRouteKey(route))) === "true";
}

function readStoredPosition(route: ReturnScrollRoute) {
  const routeKey = getRouteKey(route);
  const pendingPosition = Number(
    sessionStorage.getItem(getPendingPositionKey(routeKey)),
  );
  const scrollPosition = Number(
    Number.isFinite(pendingPosition) && pendingPosition > 0
      ? pendingPosition
      : sessionStorage.getItem(getStorageKey(routeKey)),
  );

  return Number.isFinite(scrollPosition) && scrollPosition > 0
    ? scrollPosition
    : null;
}

function shouldRestore(route: ReturnScrollRoute) {
  const previousPathname = sessionStorage.getItem(PREVIOUS_PATH_STORAGE_KEY);
  return Boolean(
    hasPendingRestore(route) ||
      (previousPathname && route.destinationPattern.test(previousPathname)),
  );
}

function clearPendingRestore(route: ReturnScrollRoute) {
  const routeKey = getRouteKey(route);
  sessionStorage.removeItem(getPendingKey(routeKey));
  sessionStorage.removeItem(getPendingPositionKey(routeKey));
}

function writeCurrentScrollPosition(
  route: ReturnScrollRoute,
  pathname = window.location.pathname,
) {
  const routeKey = getRouteKey(route, pathname);
  sessionStorage.setItem(getStorageKey(routeKey), String(window.scrollY));
}

function writePendingScrollPosition(
  route: ReturnScrollRoute,
  pathname = window.location.pathname,
) {
  const routeKey = getRouteKey(route, pathname);
  const scrollY = String(window.scrollY);
  sessionStorage.setItem(getPendingKey(routeKey), "true");
  sessionStorage.setItem(getPendingPositionKey(routeKey), scrollY);
  sessionStorage.setItem(getStorageKey(routeKey), scrollY);
}

export function saveCurrentReturnScrollPosition(
  pathname = window.location.pathname,
) {
  const route = getRoute(pathname);
  if (!route) return;

  if (
    normalizePathname(pathname) === normalizePathname() &&
    hasPendingRestore(route)
  ) {
    return;
  }

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
  const route = getRoute(fromPathname);

  sessionStorage.setItem(PREVIOUS_PATH_STORAGE_KEY, normalizedFromPathname);

  if (!route) {
    return;
  }

  if (
    toPathname &&
    route.destinationPattern.test(normalizePathname(toPathname))
  ) {
    writePendingScrollPosition(route, fromPathname);
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

  writePendingScrollPosition(route);
  sessionStorage.setItem(PREVIOUS_PATH_STORAGE_KEY, normalizePathname());
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
  if (!route || !shouldRestore(route)) {
    return false;
  }

  const scrollPosition = readStoredPosition(route);
  if (scrollPosition === null) {
    return false;
  }

  clearPendingRestore(route);

  const restore = () => window.scrollTo(0, scrollPosition);
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      restore();
      window.setTimeout(restore, 50);
    });
  });

  return true;
}
