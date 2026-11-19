// The two local hosts (ARCH §1, PLAN §4.6): the app host and the preview host on the same port.

/** @typedef {{ app: string, preview: string | null }} Origins */

/**
 * The origin of an http(s) URL text with no path, query, fragment or user part, or null.
 * @param {string | undefined} text
 * @returns {string | null}
 */
export function parseOrigin(text) {
  if (typeof text !== "string" || text === "") return null;
  let url;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username || url.password || url.search || url.hash) return null;
  if (url.pathname !== "/") return null;
  return url.origin;
}

/**
 * @param {{ appOrigin: string | null, previewOrigin: string | null }} config
 * @param {number | null} port the bound port of the Node server, null in the function
 * @returns {Origins}
 */
export function originsFor(config, port) {
  const app = config.appOrigin ?? (port ? `http://127.0.0.1:${port}` : null);
  const preview =
    config.previewOrigin ?? (port ? `http://localhost:${port}` : null);
  return { app: app ?? "", preview };
}

/**
 * Whether a request came to the preview host. The Host of the request URL is compared with the configured
 * preview host only; X-Forwarded-Host is never read.
 * @param {URL} url
 * @param {Origins} origins
 * @returns {boolean}
 */
export function isPreviewHost(url, origins) {
  if (!origins.preview) return false;
  return url.host.toLowerCase() === new URL(origins.preview).host;
}
