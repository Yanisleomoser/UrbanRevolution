/**
 * Make external CDNs load in a headless Playwright page in this dev environment.
 *
 * Why: outbound HTTPS from the session goes through an agent proxy. Node's fetch
 * is wired to it (proxy + CA env), but the bundled Chromium is NOT — so GSAP /
 * three.js / MediaPipe / Sentry fetched from jsDelivr et al. fail with
 * ERR_CONNECTION_CLOSED and the landing animation + WebGL globe never render
 * headless. That blocked self-verifying any animation/3D feature locally.
 *
 * Fix: intercept CDN requests and fulfil them by fetching in Node (which works),
 * so Chromium never has to reach the proxy itself. It's a no-op on CI / direct
 * internet — there Node's fetch just fetches the same bytes directly.
 *
 *   import { routeCdnThroughNode } from "./cdn-route.mjs";
 *   await routeCdnThroughNode(page);   // before page.goto(...)
 */

// Hosts the app pulls render-critical/optional assets from at runtime.
const CDN_HOSTS =
  /^https:\/\/(cdn\.jsdelivr\.net|js-de\.sentry-cdn\.com|cdn\.vercel-insights\.com|unpkg\.com|cdn\.skypack\.dev|storage\.googleapis\.com)\//;

export async function routeCdnThroughNode(page) {
  await page.route(CDN_HOSTS, async (route) => {
    try {
      const res = await fetch(route.request().url());
      const body = Buffer.from(await res.arrayBuffer());
      await route.fulfill({
        status: res.status,
        // CORS header is required: these load as cross-origin modules/scripts,
        // and Chromium enforces CORS even on a fulfilled response.
        headers: {
          "content-type": res.headers.get("content-type") || "application/javascript",
          "access-control-allow-origin": "*",
        },
        body,
      });
    } catch {
      await route.abort();
    }
  });
}
