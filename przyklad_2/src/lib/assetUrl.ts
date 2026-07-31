// Files in public/ are referenced as plain strings, which Vite does not rewrite
// for the configured base the way it rewrites index.html and bundled imports.
// The campaign is deployed under /przyklad_2/dist/, so a root-absolute
// "/images/..." would resolve against the portfolio root and 404. Route every
// public asset through the base URL instead.
export const assetUrl = (path: string) =>
  `${import.meta.env.BASE_URL}${path.replace(/^\/+/, "")}`;
