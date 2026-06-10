# GitHub Copilot — Projektanweisungen (Urban Revolution)

> Diese Datei ist das Pendant zu `CLAUDE.md` für GitHub Copilot / Copilot CLI.
> **Verbindliche Quelle bleibt `CLAUDE.md` im Repo-Root** — bei Konflikt gilt
> `CLAUDE.md`. Diese Datei ist die kompakte Fassung plus der Review-Auftrag für
> die Zusammenarbeit mit Claude Code.

## Was das ist
Statische Marken-Website (HTML + Vanilla-JS-Module + CSS, **kein Framework**,
**kein Build-Step**). KI-entworfene Einzelstücke nach Maß aus recycelter
Kleidung — gegen Fast Fashion, für echtes Textil-Recycling.
Deploy: Vercel. Sprachen: DE + EN. Live: `revolveurban.com`.

## Architektur — nicht umbauen
- Kein Bundler/Transpiler. Klassische `<script>`-Module im `window.X = …`-IIFE-
  Muster, in `index.html` in fester Reihenfolge eingebunden (`config.js` zuerst).
- Die Design-Engine (`js/design-engine/`) sind **ebenfalls klassische
  `<script>`-Module** (datengetrieben — Nodes/Archetypen/Attribute liegen in
  JSON, nicht im Code).
- Einzige Ausnahme: die `js/3d/`-Render-Module sind ES-Module, dynamisch von
  `controller.js` importiert (nicht als `<script>`-Tag).
- State: `state-manager.js` (single source of truth, localStorage). Config:
  `js/config.js` (`window.CONFIG`) ist die zentrale Wahrheit — **dort zuerst
  ändern**, andere Module ziehen nach.
- Keinen Bundler / kein neues Modulsystem einführen, ohne vorher zu fragen.

## Harte Regeln (immer)
- **Mobile-first.** Höhen in `svh`/`dvh` bzw. gepinntem `--svh`, **nie rohes
  `vh`**. Safe-Area via `env(safe-area-inset-*)`. Auf ≤ 480 px testen.
- **Barrierefrei:** Tastatur, Fokus-States, ARIA, `prefers-reduced-motion`.
- **Zweisprachig:** ALLE sichtbaren Strings über `js/i18n.js` (DE **und** EN).
  Niemals user-facing Copy hartkodieren. Code-Identifier Englisch; HTML-
  Kommentare und Rechtsseiten Deutsch.
- **Datengetrieben bleiben:** neue Fragen/Optionen/Archetypen über JSON, nicht
  hartkodieren.
- **Design-System:** nur bestehende `:root`-Tokens. Hintergrund Midnight-Navy
  `#0A1622`, Akzent-Verlauf `--gradient` (Ozean-Blau → Teal → Aqua). Fonts NUR
  Lora (Display) + Poppins (Body) — keine anderen.
- **Validate at the boundary:** User-/AI-Input über `CONFIG.validate*` führen.
- **Feedback** über `showToast(message, type)`, nicht `alert`. **Geld** in CHF.
- Bestehende Flows (Maße, KI, i18n, State, 3D) nicht brechen. **Keine
  Console-Fehler.**

## Secrets
- Replicate-/Anthropic-Token **nie** committen, nie in Logs/Chat — nur via
  gitignored `.env` oder Vercel-Env. Sentry-DSN ist clientseitig/öffentlich, darf
  im Code stehen.

## CI (Pflicht, grün vor Merge)
Vier Checks, alle müssen grün sein:

| Check          | Befehl                            |
| -------------- | --------------------------------- |
| `test`         | `deno lint` (Deno 2.x)            |
| `validate`     | `npm run build` (No-op) + `npm test` |
| `validate-css` | `node scripts/validate-css.mjs`   |
| `validate-html`| `npx htmlhint` (inkl. insights.html) |

## Lokal laufen lassen
```bash
python3 -m http.server 8080     # statisch
# oder: npm run dev  (→ npx serve .)
```
`/api/*`-Edge-Functions laufen nur via `vercel dev` / auf Vercel.

---

## Zusammenarbeit mit Claude Code (Rollen)
Claude Code (Web) und Copilot CLI arbeiten über **Git-Branches + GitHub-PRs** —
der PR ist der Übergabepunkt, nicht eine Live-Verbindung.

- **Claude Code = Builder:** arbeitet auf einem Feature-Branch, pusht, öffnet
  einen **Draft-PR**.
- **Copilot CLI = Reviewer/Tester:** checkt den Branch aus, läuft `npm test`,
  `node scripts/validate-css.mjs`, `npx htmlhint index.html impressum.html
  datenschutz.html`, und postet konkrete Befunde als **PR-Review-Kommentare**.
- **Guardrail:** Immer nur *ein* Agent besitzt einen Branch gleichzeitig. Draft =
  Builder ist dran; „Ready for review" = Reviewer ist dran. Keine parallelen
  Edits am selben Branch.

### Review-Checkliste für Copilot
Beim Review eines PRs prüfen:
1. Alle vier CI-Checks (`validate` enthält `npm test`) lokal grün?
2. Neue sichtbare Strings in **DE und EN** in `i18n.js`?
3. Keine rohen `vh` (stattdessen `svh`/`dvh`/`--svh`)? Mobile (≤ 480 px) ok?
4. Nur bestehende `:root`-Tokens, nur Lora/Poppins?
5. Keine hartkodierten Werte, die in `config.js`/JSON gehören?
6. Keine Secrets im Diff? Keine Console-Fehler?
7. Barrierefreiheit (Fokus, ARIA, `prefers-reduced-motion`) gewahrt?

Befunde knapp, umsetzbar und mit Datei/Zeile als PR-Review-Kommentare posten.
