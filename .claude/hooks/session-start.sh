#!/bin/bash
# SessionStart hook — prepares a Claude Code on the web session so the agent
# can (a) run the same CSS/HTML validators the CI uses and (b) render the
# site to PNG for visual checks (scripts/shoot.mjs), without a human having
# to eyeball the page in a browser.
#
# Web-only + idempotent. The headless browser step is best-effort: a CDN
# hiccup must not abort the whole session.
set -euo pipefail

# Only run in the remote (web) environment; local CLI sessions keep their own setup.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# 1. Project deps — pulls @vercel/speed-insights plus the css-tree / htmlhint
#    validators behind `npm run validate:css` and `npm run validate:html`.
#    --include=dev is required because this environment sets NODE_ENV=production,
#    which would otherwise skip devDependencies AND rewrite package-lock.json
#    (leaving the working tree dirty every session).
npm install --include=dev

# 2. Headless Chromium for visual checks. `--no-save` keeps playwright-core
#    out of package.json so the Vercel deploy stays lean; --include=dev keeps
#    the lockfile in sync (see above). Best-effort.
npm install --no-save --include=dev playwright-core || echo "hook: playwright-core install failed (screenshots disabled)"
npx --yes playwright@latest install chromium || echo "hook: chromium download failed (screenshots disabled)"

# Persist the browser path so scripts/shoot.mjs finds Chromium this session.
if [ -n "${PLAYWRIGHT_BROWSERS_PATH:-}" ] && [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo "export PLAYWRIGHT_BROWSERS_PATH=\"$PLAYWRIGHT_BROWSERS_PATH\"" >> "$CLAUDE_ENV_FILE"
fi

echo "hook: setup complete"
