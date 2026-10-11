export function saveScrollPosition() {
  const state = window.history.state;
  if (!state || !Number.isFinite(state.index)) return;

  // Astro saves on scrollend (or a timer), which may not run before a mobile
  // pull-to-refresh. Flush the outgoing entry while its scroll is still
  // available so router startup reads the current position, not an old Back
  // position. pagehide also preserves eligibility for the back/forward cache.
  window.history.replaceState(
    {
      ...state,
      scrollX: Math.max(0, window.scrollX),
      scrollY: Math.max(0, window.scrollY),
    },
    "",
  );
}
