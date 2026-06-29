/**
 * Minimal, safe static file server for the headless harnesses (e2e + shoot).
 *
 * Serves the repo root the way Vercel serves it: correct MIME types, no path
 * traversal, "/" → index.html. Shared by scripts/e2e.mjs and
 * scripts/shoot-sections.mjs so the two harnesses boot the site identically
 * (no second copy to drift). No third-party deps — just node:http.
 *
 *   import { startServer } from "./static-server.mjs";
 *   const server = await startServer();              // listens on a free port
 *   const base = `http://127.0.0.1:${server.address().port}`;
 *   // ... use it ...
 *   server.close();
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";

export const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
};

// Boot a static server for `root` on a free port. Resolves with the listening
// server (read its port from server.address().port; stop it with .close()).
export function startServer(root = process.cwd()) {
  const server = createServer(async (req, res) => {
    try {
      let path = decodeURIComponent((req.url || "/").split("?")[0]);
      if (path.endsWith("/")) path += "index.html";
      const abs = normalize(join(root, path));
      if (!abs.startsWith(root) || !existsSync(abs)) { res.statusCode = 404; res.end("404"); return; }
      const body = await readFile(abs);
      res.setHeader("Content-Type", MIME[extname(abs).toLowerCase()] || "application/octet-stream");
      res.end(body);
    } catch {
      res.statusCode = 500; res.end("500");
    }
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}
