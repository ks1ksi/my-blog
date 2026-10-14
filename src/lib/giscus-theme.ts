/** Site-coloured Giscus theme (public/giscus/*.css) for the current mode. */
export function giscusThemeUrl(dark: boolean) {
  return new URL(`/giscus/${dark ? "dark" : "light"}.css`, location.origin)
    .href;
}
