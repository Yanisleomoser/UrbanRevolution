/**
 * Urban Revolution — Internationalisierung (DE / EN)
 *
 * IIFE-with-global im Stil der übrigen Module. Stellt window.I18N bereit.
 * Lädt direkt nach config.js, damit alle übrigen Module zur Laufzeit
 * I18N.t() nutzen können.
 *
 * Funktionsweise:
 *  - Statische Texte in index.html tragen data-i18n-Attribute. apply()
 *    läuft die DOM ab und ersetzt Text / HTML / placeholder / aria-label
 *    anhand des Schlüssels.
 *  - Dynamisch erzeugte Texte (Toasts, Spec-Sheet, Vorschläge) rufen
 *    I18N.t(key, vars) direkt auf.
 *  - setLang() persistiert die Wahl in localStorage, aktualisiert
 *    <html lang>, übersetzt die statische DOM neu und feuert ein
 *    `language:change`-Event, auf das app.js zum Neu-Rendern lauscht.
 */
const I18N = (() => {
  const STORAGE_KEY = "urev_lang";
  const SUPPORTED = ["de", "en"];
  const DEFAULT_LANG = "de";

  const dict = {
    de: {
      // ── <head> ──
      "head.title": "Urban Revolution — Erschaffe die Zukunft der Mode",
      "meta.description": "Urban Revolution ist eine Vision: Du entwirfst dein Kleidungsstück, eine vollautonome Kreislauf-Fabrik soll es eines Tages aus weggeworfener Mode fertigen — nach deinen Massen, ohne Überproduktion. Sei von Anfang an dabei.",
      "meta.og_title": "Erschaffe die Zukunft der Mode — Urban Revolution",
      "meta.og_description": "Eine Vision für Mode ohne Überproduktion: dein Entwurf, eines Tages autonom gefertigt aus recycelter Kleidung. Werde Teil der Bewegung.",

      // ── Navigation ──
      "nav.skip": "Zum Inhalt springen",
      "nav.aria": "Hauptnavigation",
      "nav.production": "Produktion",
      "nav.lang_aria": "Sprache wechseln",
      "nav.community": "Community",
      "nav.enter": "UR Create starten",

      // ── UR-Create-Direktive (Hero · UR Create · Ownership · Galerie · Problem · Alternative · Vision · Join · Final) ──
      "urcreate.label": "[ UR CREATE ]",
      "urcreate.h2": "Deine Idee kommt zuerst",
      "urcreate.intro": "Beschreibe deine Idee und entwickle sie weiter, bis das Stück wirklich deins ist — Stil, Form, Material.",
      "own.eyebrow": "[ DEIN MOMENT ]",
      "own.headline_html": "Dieses Design existiert, <em>weil du es erschaffen hast.</em>",
      "own.text": "Die meiste Mode entsteht andersherum: Millionen Kleidungsstücke werden produziert, bevor irgendjemand danach gefragt hat. Urban Revolution glaubt, dass Kreativität zuerst kommt.",
      "own.save": "Meine Kreation speichern",
      "own.share": "Teilen",
      "own.publish": "In der Galerie zeigen",
      "own.photoreal_html": "Sieh sie fotorealistisch <span aria-hidden=\"true\">↓</span>",
      "own.why_html": "Entdecke, warum das zählt <span aria-hidden=\"true\">↓</span>",
      "own.makereal_html": "Mach es real — Masse &amp; Fertigung <span aria-hidden=\"true\">→</span>",
      "own.saved": "Gespeichert in deiner Sammlung.",
      "own.shared": "Link kopiert — teile deine Kreation.",
      "own.published": "In der Community-Galerie veröffentlicht.",
      "own.see_title": "Sieh es an dir.",
      "own.see_sub": "Wähle eine der Vorschau-Personen — oder lade dein eigenes Ganzkörperfoto hoch.",
      "own.stage_tag": "Dein Stück",
      "own.upload_own": "Eigenes Foto hochladen",
      "own.upload_hint": "Ganzkörper, gerade Haltung. Dein Foto bleibt auf deinem Gerät, bis du die Vorschau startest.",
      "own.or_pick": "oder",
      "own.presets_label": "Vorschau-Personen",
      "own.preset_alt": "Vorschau-Person {n}",
      "own.info_title": "Dein Design",
      "own.info_type": "Typ",
      "own.info_material": "Material",
      "own.info_color": "Farbe",
      "own.info_fit": "Passform",
      "own.info_length": "Länge",
      "own.info_size": "Grösse",
      "own.edit_summary": "Weiter anpassen",
      "own.edit_hint": "Änderungen sind sofort übernommen — generiere die Vorschau neu, um sie an dir zu sehen.",
      "gal.label": "[ COMMUNITY ]",
      "gal.h2": "Keine zwei Visionen sind gleich",
      "gal.intro": "Kreationen aus der Community — sieh sie an, lass dich inspirieren oder remixe sie als Start deiner eigenen Evolution.",
      "sphere.canvas_aria": "Schwebende Community-Designs — ziehen oder Pfeiltasten zum Drehen, Tippen oder Enter öffnet",
      "sphere.hint": "Ziehen oder Pfeiltasten · Tippen oder Enter",
      "sphere.cta": "Werde Teil davon",
      "sphere.close": "Schliessen",
      "sphere.detail_kicker": "Community-Kreation",
      "sphere.by": "von",
      "sphere.detail_line": "Einzelstück aus recycelter Kleidung — entworfen in UR Create.",
      "sphere.detail_cta": "Eigene Vision erschaffen",
      "sphere.detail_remix": "Dieses Stück remixen",
      "sphere.detail_join": "Oder werde Teil der Community",
      "join.h2": "Gemeinsam wird daraus eine Bewegung",
      "join.sub": "Werde Teil der Menschen, die Mode neu denken — gestalte mit, verfolge die Reise oder bring deine Ideen ein.",
      "join.legend": "Wie möchtest du teilnehmen?",
      "join.p1": "Designs erschaffen",
      "join.p2": "Die Reise verfolgen",
      "join.p3": "Ideen beitragen",
      "join.p4": "Auf dem Laufenden bleiben",
      "join.email_label": "E-Mail-Adresse",
      "join.email_ph": "deine@email.ch",
      "join.cta": "Urban Revolution beitreten",
      "join.consent": "Ich möchte Updates erhalten (jederzeit abbestellbar). Es gilt die Datenschutzerklärung.",
      "join.ok": "Willkommen in der Revolution. Wir melden uns.",
      "join.err_email": "Bitte gib eine gültige E-Mail-Adresse ein.",
      "join.err_consent": "Bitte bestätige die Einwilligung.",
      "join.err": "Etwas ging schief. Bitte später erneut versuchen.",

      // ── Hero ──

      // ── Begin experience (cursor-first opening — no selling, just begin) ──

      // ── Geführter Funnel (Hilf-mir-entscheiden) ──

      // ── Manifesto (compact thesis after the hero) ──

      // ── Section labels (Ovyon-style [ NN / Titel ] kicker) ──
      "sec.measure": "[ Deine Masse ]",
      "sec.production": "[ Produktion ]",
      "sec.faq": "[ FAQ ]",

      // ── Facts block (consolidated [ 01 / Das Problem ]) ──

      // ── Live-Abfall-Zähler (Ticker, C+A) ──
      "ticker.unit": "kg",
      "ticker.live": "Live",
      "ticker.live_rate": "Live · jede Sekunde +2'918 kg",
      "ticker.cap_full": "Textilien verbrannt oder vergraben, seit du hier bist.",
      "ticker.cap_short": "verbrannt oder vergraben · seit du hier bist",
      "ticker.source": "[ Quelle: UNEP · 92 Mio. t / Jahr ]",

      // ── Visual Scroll Story (6 acts) ──
      // Live counter (acts I–IV)

      // ── The true cost (fast-fashion evidence band) ──

      // ── Trust-Strip ──

      // ── How it works (3-step) ──

      // ── Workflow ──

      // ── Design-Sektion ──
      "design.prompt_label": "Dein Prompt für die KI",
      "design.prompt_placeholder": "z.B.: Ein oversized Streetwear-Hoodie aus schwerem Bio-Baumwoll-Fleece, in einem dunklen Olivton mit graphischen Stickereien auf der Brust, weite Ärmel, mit Känguru-Tasche und gefüttert mit Kapuze...",
      "design.suggestions_inspiration": "Inspiration",
      "design.suggestions_foryou": "Für dich",
      "design.library_trigger": "Meine Designs",
      "design.garment_label": "Kleidungstyp",
      "design.generate_btn": "Design generieren",
      "design.generate_loading": "Dein Entwurf entsteht...",

      // ── Kleidungstypen ──
      "type.tshirt": "T-Shirt",
      "type.hoodie": "Hoodie",
      "type.shirt": "Hemd",
      "type.pants": "Hose",
      "type.jacket": "Jacke",
      "type.dress": "Kleid",

      // ── Materialien ──
      "material.cotton": "Bio-Baumwolle",
      "material.linen": "Leinen",
      "material.denim": "Denim",
      "material.wool": "Wolle",
      "material.fleece": "Fleece",
      "material.silk": "Seide",
      "material.polyester": "Recycled Polyester",

      // ── Passform ──
      "fit.slim": "Slim",
      "fit.regular": "Regular",
      "fit.oversized": "Oversized",

      // ── Länge ──
      "length.cropped": "Cropped",
      "length.regular": "Regular",
      "length.long": "Lang",

      // ── Vorschau-Chips: Dimensions-Mikrolabels ──
      "chip.style": "Stil",
      "chip.fit": "Fit",
      "chip.length": "Länge",
      "chip.material": "Stoff",
      "chip.pattern": "Muster",
      "engine.dock_aria": "Zur Vorschau springen",

      // ── Design Engine (Reise) ──
      "engine.back": "Zurück",
      "engine.skip": "Überspringen",
      "engine.finish_early": "Fertig",
      "engine.phase_aria": "Design-Phase",
      "engine.phase_feeling": "Gefühl",
      "engine.phase_form": "Form",
      "engine.phase_fabric": "Stoff",
      "engine.phase_color": "Farbe",
      "engine.phase_details": "Details",
      "engine.confirm": "Weiter",
      "engine.regions_hint": "Tippe einen Punkt am Stück an und wähle — oder übernimm alles so.",
      "engine.regions_accept": "Passt so — weiter",
      "engine.region_unset": "noch offen",
      "engine.region_close": "Schliessen",
      "engine.region_current": "aktuell",
      "engine.scheme_mono": "Uni",
      "engine.scheme_duo": "Verlauf",
      "engine.duo_hint": "Zwei Stoffe antippen — die Reihenfolge bestimmt den Verlauf.",
      "engine.generate": "Design generieren",
      "engine.generating": "Generiere …",
      "engine.regenerate": "Neu generieren — mehr individualisieren",
      "engine.fallback_summary": "Lieber direkt in Worten beschreiben?",
      "engine.restart": "Neu starten",
      "engine.refine_title": "Dein Design",
      "engine.concepts_title": "Vier Richtungen aus deinen Entscheidungen — wähle oder entwickle weiter",
      "engine.concepts_hint": "Jede Karte ist ein eigener Evolutionspfad. „Weiterentwickeln“ erzeugt die nächste Version — so lange du willst.",
      "engine.evolve": "Weiterentwickeln",
      "engine.evolved": "Version {v}",
      "engine.evolve_back_aria": "Eine Version zurück",
      "engine.concept_original": "Original",
      "engine.concept_picked": "Richtung übernommen",
      "engine.concept_pick_aria": "Konzept {n} auswählen",
      "concept.warmer": "Wärmer",
      "concept.cooler": "Kühler",
      "concept.slimmer": "Schmaler",
      "concept.wider": "Weiter",
      "concept.sheen": "Mehr Glanz",
      "concept.matte": "Matter",
      "concept.pattern": "Muster gewagt",
      "concept.cleaner": "Ruhiger",
      "concept.len_cropped": "Cropped",
      "concept.len_regular": "Hüftlang",
      "concept.len_long": "Länger",
      "concept.subtle": "Feiner Dreh",
      "engine.refine_inferred": "Aus deinem Stil ergänzt",
      "engine.refine_adjust": "Justieren — wärmer / kälter",
      "engine.deeper": "Tiefer verfeinern",
      "engine.nudge_down": "weniger",
      "engine.nudge_up": "mehr",
      "engine.changed_color": "Farbwelt",
      "engine.rank_up": "nach oben",
      "engine.rank_down": "nach unten",
      "engine.changed_details": "Details",
      "engine.share": "Teilen",
      "engine.share_copied": "Link kopiert",
      "engine.intro_title": "Finde heraus, was du suchst.",
      "engine.intro_sub": "Keine Beschreibung nötig — wähle, vergleiche, fühle. Dein Stück entsteht aus deinen Entscheidungen. Den letzten Schliff gibst du am Ende mit einem Satz, aus dem die KI dein Einzelstück einmal fertigen soll.",
      "engine.intro_start": "Reise beginnen",
      "engine.load_fail": "Die Reise konnte nicht geladen werden. Bitte lade die Seite neu.",
      "engine.refine_freetext_label": "Etwas, das wir nicht erraten konnten? Ergänze es in einem Satz.",
      "engine.refine_freetext_ph": "z.B. verdeckte Knopfleiste, Innentasche fürs Handy …",

      // ── VTO ──
      "vto.btn": "Fotorealistische Vorschau generieren",
      "vto.disclaimer": "Sendet dein Foto + die Design-Beschreibung an Replicate (FLUX Kontext) für die fotorealistische Generierung. Externe API, ~10 Sekunden Wartezeit.",
      "vto.modal_close": "Schliessen",
      "vto.generating": "Generiere fotorealistische Vorschau...",
      "vto.result_alt": "Fotorealistische Vorschau",
      "vto.download": "Bild speichern",
      "vto.hint_no_photo": "Wähle eine Person oder lade dein Foto hoch",
      "vto.hint_no_design": "Generiere zuerst ein Design",
      "vto.hint_limit": "Demo-Limit erreicht ({limit}/{limit}) — kontaktiere uns für mehr",
      "vto.hint_ready_first": "Klick generiert deine fotorealistische Vorschau ({limit} pro Browser)",
      "vto.hint_ready_remaining": "Klick generiert deine fotorealistische Vorschau ({remaining} von {limit} übrig)",
      "vto.status_sending": "Sende Anfrage an Replicate...",
      "vto.error_pending": "Generierung läuft länger als erwartet (>20 s) — Server-Limit erreicht. Bitte erneut versuchen oder andere Uhrzeit probieren.",
      "vto.error_unexpected": "Unerwartete Antwort vom Server.",
      "vto.error_prefix": "Fehler: {msg}",
      "vto.error_network": "Netzwerkfehler: {msg}",

      // ── Generische, neutrale Service-Fehler (Edge-Function-Codes) ──
      "err.service_unavailable": "Der Bild-Dienst ist gerade nicht verfügbar. Bitte versuch es später erneut.",
      "err.rate_limited": "Gerade sind viele Anfragen unterwegs — bitte in einer Minute erneut versuchen.",
      "err.failed": "Die Generierung ist fehlgeschlagen. Bitte versuch es erneut.",

      // ── Bibliothek ──
      "library.title": "Meine Designs",
      "library.close": "Schliessen",
      "library.empty": "Noch keine gespeicherten Designs. Erstelle eines und drücke „Speichern“ in der Design-Karte.",
      "library.count": "{n} von {max} Designs gespeichert",
      "library.load": "Laden",
      "library.delete": "Löschen",

      // ── Masse-Sektion ──
      "measure.h2": "Deine Körpermasse",
      "measure.intro": "Damit dein Kleidungsstück perfekt sitzt, brauchen wir deine genauen Masse.",
      "meas.note": "Die Masse sind eine Schätzung und bleiben jederzeit anpassbar.",
      "measure.photo_h4": "Masse aus Foto",
      "measure.photo_body": "Lade ein Ganzkörperfoto hoch (gerade stehend, T-Pose oder Arme leicht zur Seite). MediaPipe analysiert die Pose und schätzt deine Masse automatisch.",
      "measure.photo_privacy": "100% clientseitig — dein Bild verlässt nie dein Gerät.",
      "measure.photo_btn": "Foto auswählen",
      "measure.photo_btn_loading": "Lade Modell...",
      "measure.photo_btn_analyzing": "Analysiere...",
      "measure.photo_btn_another": "Anderes Foto auswählen",
      "measure.status_detecting": "Erkenne Pose...",
      "measure.status_no_pose": "Keine Pose erkannt.",
      "measure.status_no_feet": "Füsse nicht im Bild — neues Foto bitte",
      "measure.status_error": "Fehler — bitte erneut versuchen.",
      "measure.status_result": "{chest}cm Brust · {waist}cm Taille · {hips}cm Hüfte",
      "measure.size_label": "Empfohlene Konfektionsgrösse",
      "measure.detail_toggle": "Masse im Detail anpassen",
      "measure.jump_aria": "{label} – zum Eingabefeld springen",
      "measure.range_error": "{label}: muss zwischen {min} und {max} {unit} liegen",
      "measure.figure_hint": "Tippe eine Markierung, um den Wert anzupassen",

      // ── Voreinstellungen ──
      "preset.s": "Voreinstellung S",
      "preset.m": "Voreinstellung M",
      "preset.l": "Voreinstellung L",
      "preset.xl": "Voreinstellung XL",

      // ── Mass-Bezeichnungen ──
      "ml.height": "Körpergrösse",
      "ml.weight": "Gewicht",
      "ml.chest": "Brustumfang",
      "ml.waist": "Taillenumfang",
      "ml.hips": "Hüftumfang",
      "ml.shoulder": "Schulterbreite",
      "ml.arm": "Armlänge",
      "ml.inseam": "Schrittlänge",
      "ml.neck": "Halsumfang",

      // ── Körperdiagramm (SVG) ──
      "svg.body_aria": "Massdiagramm Körper",
      "svg.shoulder": "Schulter",
      "svg.chest": "Brust",
      "svg.waist": "Taille",
      "svg.hips": "Hüfte",
      "svg.inseam": "Schritt",
      "svg.height": "Körpergrösse",

      // ── 3D-Vorschau ──
      "preview.example_tag": "Beispiel",

      // ── Entwurfs-Vorschau (KI-Studio-Render im Design-Schritt) ──
      "dpreview.fallback_badge": "STILVORSCHAU",
      "dpreview.genesis_badge": "ES ENTSTEHT …",

      // ── Produktion ──
      "prod.h2": "Produktions-Vorlage",
      "prod.intro": "Dein Design-Konzept mit allen Massen und Details — bereit für den Tag, an dem wir fertigen.",
      "spec.brief_h4": "Design Brief",
      "spec.drawing_h4": "Technische Zeichnung — Vorderansicht",
      "spec.drawing_note": "Parametrische Zeichnung aus deinen Entscheidungen — die Proportionen folgen deinen Massen.",
      "spec.specs_h4": "Spezifikationen",
      "spec.type": "Kleidungstyp",
      "spec.material": "Material",
      "spec.color": "Primärfarbe",
      "spec.fit": "Passform",
      "spec.length": "Länge",
      "spec.print": "Aufschrift",
      "spec.size": "Konfektionsgrösse",
      "spec.measures_h4": "Masse (cm)",
      "spec.notes_h4": "Konstruktions-Notizen für die Fertigung",
      "spec.id_prefix": "Design ID: {id}",
      "export.h3": "Dein Entwurf, dokumentiert",
      "export.intro": "Lade dein Design-Konzept herunter — oder sei dabei, wenn die Produktion startet.",
      "export.json": "JSON Daten herunterladen",
      "export.html": "Druckbare Vorlage (HTML)",
      "export.print": "Direkt drucken",
      "export.send": "Sei dabei, wenn die Produktion startet",
      "export.original_prompt": "Original Prompt",
      "export.tags": "Tags",
      "export.body_measures": "Körpermasse",
      "export.production_data": "Produktionsdaten",
      "export.est_fabric": "Geschätzte Stoffmenge",
      "export.est_seams": "Geschätzte Nahtlänge",
      "export.duration": "Produktionsdauer",
      "export.price_range": "Preisspanne",
      "export.footer": "Generiert von Urban Revolution — autonome Kreislauf-Fertigung",
      "est.time_label": "Produktion:",
      "est.price_label": "Preis:",
      "est.days": "{n} Tage",
      "est.future": "Voraussichtlich nach dem Launch",
      "est.price_planned": "Richtwert (geplant)",
      "prod.placeholder_desc": "Noch kein Design generiert. Beschreibe oben dein Wunsch-Outfit.",
      "prod.placeholder_note": "Generiere zuerst ein Design, um Konstruktions-Notizen zu erhalten.",
      "prod.placeholder_name": "Untitled Design",

      // ── FAQ ──
      "faq.h2": "Häufige Fragen",
      "faq.intro": "Alles was du wissen willst, bevor du Teil der Vision wirst.",
      "faq.q1": "Wie lange dauert die Produktion?",
      "faq.a1": "Noch wird nichts gefertigt — wir bauen die Fabrik, die das möglich macht. Sobald die Produktion startet, nennen wir hier verbindliche Zeiten. Bis dahin: keine Versprechen, die wir nicht halten können.",
      "faq.q2": "Was passiert mit meinem Foto?",
      "faq.a2": "Für die Masserkennung läuft alles direkt in deinem Browser über MediaPipe — das Foto verlässt nie dein Gerät und wird nicht gespeichert. Nur wenn du explizit die fotorealistische Vorschau anforderst, wird das Foto einmalig an Replicate (US-Server) gesendet und nach der Generierung sofort wieder verworfen.",
      "faq.q3": "Was kostet ein Stück?",
      "faq.a3": "Das steht noch nicht fest — Preise gibt es erst, wenn wir wirklich fertigen. Sei dabei, dann erfährst du es zuerst.",
      "faq.q4": "Was, wenn ich nicht gemessen wurde?",
      "faq.a4": "Drei Wege zu deinen Massen — Foto-Auswertung (1 Klick, 100 % clientseitig), manuelle Eingabe der 9 Werte, oder ein Grössen-Preset (S/M/L/XL) als Startpunkt, das du danach anpassen kannst. Deine Masse gehören zu deinem Entwurf und sind bereit, sobald die Fertigung startet.",
      "faq.q5": "Wo wird gefertigt?",
      "faq.a5": "In der geplanten vollautonomen Kreislauf-Fabrik, die weggeworfene Textilien sortiert und daraus dein Einzelstück fertigt. Trag dich ein — du erfährst als Erstes, wann und wo es so weit ist.",
      "faq.q6": "Kann ich gespeicherte Designs später bestellen?",
      "faq.a6": "Deine Entwürfe bleiben in deiner Bibliothek (lokal im Browser) gespeichert. Bestellen kannst du sie, sobald wir live gehen — dann holst du sie einfach wieder hervor.",

      // ── Footer ──
      "footer.tagline": "Du entwirfst. Autonome Roboter fertigen. Du trägst.",
      "footer.aria_atelier": "Erschaffen",
      "footer.aria_more": "Mehr",
      "footer.col_atelier": "Erschaffen",
      "footer.design_start": "Design starten",
      "footer.measure": "Körpermasse",
      "footer.col_more": "Mehr",
      "footer.code": "Code (Open Source)",
      "footer.contact": "Kontakt",
      "footer.imprint": "Impressum",
      "footer.privacy": "Datenschutz",
      "footer.credits": "Bildnachweise",
      "footer.top": "Zum Seitenanfang",
      "footer.meta_html": '© 2026 Urban Revolution · Vollautonome Kreislauf-Fertigung · <a href="impressum.html">Impressum</a> · <a href="datenschutz.html">Datenschutz</a> · Hergestellt mit <span aria-label="Liebe">♥</span> und KI',
      "footer.meta_fine": "Pre-Launch-Vision · DSGVO-konform · Foto-Auswertung 100 % clientseitig",

      // ── Design-Karte (dynamisch) ──

      // ── Farbnamen ──
      "color.#1a1a1a": "Schwarz",
      "color.#ffffff": "Weiss",
      "color.#7c2d12": "Tiefrot",
      "color.#1e3a8a": "Marineblau",
      "color.#365314": "Olivgrün",
      "color.#a16207": "Karamell",
      "color.#831843": "Burgunder",
      "color.#6b21a8": "Violett",
      "color.#f59e0b": "Sonnengelb",
      "color.#dc2626": "Rot",
      "color.custom": "Custom",
      // Engine-Muster (Design-Reise) — Chip-Fallback, wenn kein Karten-Label greift
      "pattern.stripe": "Streifen",
      "pattern.check": "Karo",
      "pattern.graphic": "Grafik",
      "pattern.abstract": "Abstrakt",
      "pattern.solid": "Uni",
      "pattern.stripes_h": "Querstreifen",
      "pattern.stripes_v": "Längsstreifen",
      "pattern.dots": "Punkte",
      "pattern.plaid": "Karo",
      "pattern.camo": "Camouflage",
      "pattern.gradient": "Farbverlauf",
      "pattern.heather": "Meliert",
      "pattern.floral": "Blumenmuster",

      // ── Vorschläge (dynamisch) ──
      "sugg.foryou_count": "{n} Design{s} erstellt",
      "sugg.try_prefix": "Probier: {label}",
      "sugg.minimal_label": "Minimal Tee",
      "sugg.minimal_prompt": "Minimalistisches schwarzes Slim-Fit T-Shirt aus Pima-Baumwolle mit Rundhalsausschnitt, leicht tailliert",
      "sugg.cyber_label": "Cyber Hoodie",
      "sugg.cyber_prompt": "Oversized Cyberpunk-Hoodie in Neon-Lila mit reflektierenden Streifen, Cropped-Schnitt, Kapuze mit Kordel",
      "sugg.oxford_label": "Oxford Hemd",
      "sugg.oxford_prompt": "Klassisches weisses Oxford-Hemd mit Button-Down-Kragen, lange Ärmel, leicht tailliert, aus 100% ägyptischer Baumwolle",
      "sugg.wide_label": "Wide-Leg Denim",
      "sugg.wide_prompt": "Hochgeschnittene Wide-Leg Jeans aus Indigo Selvedge Denim, Vintage-Waschung, fünf Taschen, Knopfleiste",

      // ── Prompt-Vorlagen (dynamisch, {color}/{mat}) ──
      "pb.tshirt": "Schlichtes {color} T-Shirt aus {mat} im Slim-Fit, Rundhalsausschnitt, leicht tailliert",
      "pb.hoodie": "Oversized {color} Hoodie aus {mat}, mit Känguru-Tasche und Kapuze, Streetwear-Stil",
      "pb.shirt": "Klassisches {color} Hemd aus {mat} mit Button-Down-Kragen, langen Ärmeln, leicht tailliert",
      "pb.pants": "Hochgeschnittene {color} Hose aus {mat}, Wide-Leg-Schnitt, klassischer Cut, fünf Taschen",
      "pb.jacket": "{color} Jacke aus {mat}, klassischer Schnitt mit Reissverschluss und Stehkragen",
      "pb.dress": "{color} Midi-Kleid aus {mat}, A-Linien-Schnitt, ärmellos, elegant",

      // ── Toasts (dynamisch) ──
      "toast.empty_prompt": "Bitte beschreibe dein gewünschtes Design",
      "toast.generated": 'Design "{name}" generiert!',
      "toast.gen_error": "Fehler bei der Generierung. Bitte erneut versuchen.",
      "toast.need_design": "Bitte zuerst ein Design generieren",
      "toast.preset_loaded": "Voreinstellung {p} geladen",
      "toast.no_person": "Keine Person im Foto erkannt — bitte Ganzkörper-Aufnahme",
      "toast.no_feet": "Foto braucht den ganzen Körper (inkl. Füsse) für korrekte Masse",
      "toast.photo_skin": "Masse + Hautton aus Foto übernommen",
      "toast.photo_only": "Masse aus Foto übernommen — überprüfe & feinjustiere bei Bedarf",
      "toast.photo_failed": "Foto-Analyse fehlgeschlagen: {msg}",
      "toast.json_done": "JSON-Datei heruntergeladen",
      "toast.html_done": "Druckbare Vorlage heruntergeladen",
      "toast.not_found": "Design nicht gefunden",
      "toast.loaded": "„{name}“ geladen",
      "toast.deleted": "„{name}“ gelöscht",
      "toast.ai_fallback": "Claude-API nicht erreichbar ({reason}) — lokaler Generator wird verwendet",
      "lib.loaded_desc": "Aus deiner Bibliothek geladen",

      // ── KI-generierte Inhalte (ai.js) ──
      "ai.fallback_desc": "Lokal generiertes Design basierend auf Prompt-Keywords",
      "ainame.tshirt": "Tee",
      "ainame.hoodie": "Hoodie",
      "ainame.shirt": "Hemd",
      "ainame.pants": "Pants",
      "ainame.jacket": "Jacket",
      "ainame.dress": "Kleid",
      "ainame.fallback": "Piece",
      "notes.tshirt": [
        "Rundhalsausschnitt mit gerippter Halsblende, 2cm breit",
        "Seitennähte mit doppelter Steppung für Strapazierfähigkeit",
        "Saum 2.5cm umgeschlagen und gesteppt",
        "Schulternaht mit Kontrastband verstärkt",
      ],
      "notes.hoodie": [
        "Kapuze doppellagig mit gefütterten Innenseiten",
        "Känguru-Tasche mit zwei Seiteneingriffen",
        "Bündchen aus Rib-Strick an Saum und Ärmeln, 6cm",
        "Tunnelzug mit Metallösen und 1cm Flachkordel",
      ],
      "notes.shirt": [
        "Button-Down Kragen mit Einlage",
        "Knopfleiste 3cm breit, 7 Knöpfe à 11mm Perlmutt",
        "Doppelte Manschette mit zwei Knöpfen",
        "Rückenpasse mit Mittelfalte 4cm",
        "Französische Nähte an Seiten und Ärmeleinsatz",
      ],
      "notes.pants": [
        "Fünf-Taschen-Konstruktion klassisch",
        "Reissverschluss YKK Metall, Knopfverschluss am Bund",
        "Bundhöhe vorne 22cm, hinten 28cm (Mid-Rise)",
        "Saum mit Kettenstich gesäumt für authentischen Look",
      ],
      "notes.jacket": [
        "Vollfutter mit Innentaschen (links, rechts)",
        "Schulterpolster 8mm dezent",
        "Reverskragen mit Knopflochstickerei",
        "Zwei Eingrifftaschen mit Klappe",
        "Ärmel-Knopfleiste mit 3 Knöpfen",
      ],
      "notes.dress": [
        "Verdeckter Reissverschluss am Rücken, YKK 50cm",
        "Brustabnäher und Taillen-Princessnähte",
        "Saum 5cm doppelt umgeschlagen, blind gesteppt",
      ],

      // ── Landing-Page (landing.html) — eigenständige Marken-Landing ──
      "landing.eyebrow": "Autonome Kreislauf-Fabrik",
      "landing.h1_line1": "Made for one.",
      "landing.h1_line2": "Not for all.",
      "landing.sub": "Einzelstücke nach deinem Entwurf, nach Mass gefertigt — aus Kleidung, die schon existiert. Keine Überproduktion. Kein Abfall. Nur deins.",
      "landing.scroll": "Scrollen",
      // Akt I — Die Linie (Manifest + Zahlen sprechen die Maschinen-Stimme)
      "landing.manifesto_label": "Akt I — Die Linie",
      "landing.manifesto": "Mode ist eine Linie geworden. Produzieren, tragen, wegwerfen — eine Richtung, ein Ende. Die Linie ist schnell. Die Linie ist billig. Und die Linie fertigt für alle — nur nie für dich.",
      "landing.verbs": "Produzieren — Tragen — Wegwerfen",
      // Akt II — Der Kreis (die Vision, Serif-Stimme)
      "landing.loop_label": "Akt II — Der Kreis",
      "landing.loop_status": "Status: Vision — noch nicht gebaut",
      "landing.loop_title": "Vier Stationen. Ein Kreis.",
      "landing.loop_sub": "Eine Fabrik, deren Fliessband kein Ende hat. Das hier ist ihr Bauplan.",
      "landing.loop_aria": "Die vier Stationen des Kreislaufs",
      "landing.stage1_title": "Getragen",
      "landing.stage1_tag": "Alle",
      "landing.stage1_text": "Jedes Stück beginnt als Kleidung mit Geschichte — gesammelt statt deponiert.",
      "landing.stage2_title": "Zurückgewonnen",
      "landing.stage2_tag": "KI",
      "landing.stage2_text": "Stoffe, Knöpfe, Nähte: Was weggeworfen wird, soll autonom sortiert und zu Rohmaterial für Neues werden.",
      "landing.stage3_title": "Entworfen",
      "landing.stage3_tag": "Du",
      "landing.stage3_text": "Du entwirfst dein Stück — dein Stil, deine Idee, nach deinen Massen.",
      "landing.stage4_title": "Wiedergeboren",
      "landing.stage4_tag": "KI",
      "landing.stage4_text": "Eine vollautonome Fabrik soll dein Stück autonom fertigen — ein Stück für einen Menschen.",
      "landing.stats_label": "Protokoll der Linie",
      "landing.stats_title": "Wohin die Linie führt",
      "landing.stat1_label": "der Kleidung wird zu neuer Kleidung recycelt",
      "landing.stat1_kicker": "Zurück",
      "landing.stat2_label": "Lkw-Ladung Textilien wird jede Sekunde deponiert oder verbrannt",
      "landing.stat2_kicker": "Wegwerfen",
      "landing.stat3_label": "der globalen CO₂-Emissionen entfallen auf die Modeindustrie",
      "landing.stat3_kicker": "Produzieren",
      "landing.facts_coda": "Weniger als ein Prozent kehrt zurück. Die Linie kennt kein Zurück — sie kennt nur weiter.",
      "landing.stats_src_html": "Quellen: <a href=\"https://www.ellenmacarthurfoundation.org/a-new-textiles-economy\" target=\"_blank\" rel=\"noopener\">Ellen MacArthur Foundation</a> · <a href=\"https://www.unep.org/news-and-stories/story/putting-brakes-fast-fashion\" target=\"_blank\" rel=\"noopener\">UNEP</a>",
      "factsB.co2_year": "≈ 1,2 Mrd. Tonnen CO₂ pro Jahr",
      "factsB.co2_since": "t CO₂ seit du hier bist",
      "factsB.co2_compare": "mehr als internationale Flüge (≈ 2 %) und Schifffahrt (≈ 2 %) zusammen",
      "factsB.truck_rate": "1 Lkw-Ladung / Sekunde",
      "factsB.return_note": "Von 100 Teilen schafft es nicht einmal eines zurück.",
      "landing.cta_title_html": "Trag etwas, das es <em>nur einmal</em> gibt.",
      "landing.cta_sub": "Beschreibe deine Idee — du gestaltest dein Stück, wir fertigen es. Nach Mass, aus recycelter Kleidung.",
      "landing.handoff": "Der Kreis wartet auf sein erstes Stück.",
      "landing.tap_hint": "Tipp ins Bild — die Fäden formen dein nächstes Stück.",
      "landing.orb_aria": "UR Create starten — öffnet das Studio",
      "landing.portal_opening": "Studio öffnet …",

      // ── Die Wende (#pivot) — die Linie biegt sich zum Kreis ──
      "pivot.label": "Die Wende",
      "pivot.question": "Und wenn es doch ein Zurück gäbe?",
      "pivot.hinge": "Wir biegen die Linie zurück zum Kreis.",
      "pivot.mission": "Unsere Mission: das Ende der Geraden. Was die Linie wegwirft, soll Material werden — für das Gegenteil von Masse.",

      // ── KI, richtig eingesetzt (Landing-Beat #4) ──
      "aidr.label": "KI, richtig eingesetzt",
      "aidr.h2_html": "KI kann die Linie <em>beschleunigen</em>. Oder den Kreis <em>schliessen</em>.",
      "aidr.dim_tag": "Auf der Linie",
      "aidr.dim_h": "Vorhersagen, anstossen, wiederholen",
      "aidr.dim_p": "Empfehlungssysteme, die dich schneller zum nächsten Kauf bringen. KI, die die Linie füttert — sie erzeugt neue Bedürfnisse.",
      "aidr.lit_tag": "Im Kreis",
      "aidr.lit_h": "Sehen, trennen, zurückgewinnen",
      "aidr.lit_p": "KI auf den Abfallberg gerichtet: Sie soll entwirren, was weggeworfen wurde, damit es neu leben kann.",
      "aidr.body_html": "Das schwierige Problem im Kreis war nie das Nähen — es ist das Entwirren des Weggeworfenen: Mischfasern, Knöpfe, Nähte, Farben. Ein Berg, den keine menschliche Linie im grossen Massstab sortieren kann. Genau dort soll die Maschine arbeiten: <strong>den Stoff sortieren und das Stück bauen. Mehr nicht.</strong> Das Design bleibt deins — du gibst den Stil vor, du triffst jede Entscheidung. <strong>Die KI entwirft nie.</strong>",

      // ── Der Mittelpunkt (Landing-Beat #2 — Identität, der eine warme Akzent) ──
      "identity.label": "Der Mittelpunkt",
      "identity.h2_html": "In der Mitte dieses Kreises: <em>du</em>.",
      "identity.body_html": "Die Linie fertigte für alle — dasselbe Stück, millionenfach, in einer Grösse, die niemandem gehört. Der Kreis dreht sich anders: um dich. <strong>Identität wählt man nicht aus Optionen. Man macht sie.</strong>",
      "how.label": "So funktioniert's",
      "how.title": "Vier Schritte auf deinem Bogen",
      "how.sub": "Das ist deine Seite des Kreises — vom ersten Satz zur dokumentierten Vorlage. Du hältst den Faden, die Maschine hält die Nadel.",
      "how.s1_label": "Du entwirfst",
      "how.s1_line": "Ein Satz genügt. Die Idee ist deine — und bleibt es.",
      "how.s2_label": "Du entscheidest",
      "how.s2_line": "Die Engine fragt, du wählst: Schnitt, Stoff, Farbe. Jede Antwort schärft dein Stück.",
      "how.s3_label": "Deine Masse",
      "how.s3_line": "Neun Körpermasse — per Foto direkt im Browser, von Hand oder als Preset. Eine Schätzung, jederzeit anpassbar.",
      "how.s4_label": "Deine Vorlage",
      "how.s4_line": "Ein dokumentiertes Einzelstück — bereit für den Tag, an dem sich der Kreis zum ersten Mal schliesst.",
      "how.anchor": "So funktioniert's",
    },

    en: {
      // ── <head> ──
      "head.title": "Urban Revolution — Create the future of fashion",
      "meta.description": "Urban Revolution is a vision: you design your garment, and a fully autonomous circular factory will one day make it from discarded fashion — to your measurements, without overproduction. Be part of it from the start.",
      "meta.og_title": "Create the future of fashion — Urban Revolution",
      "meta.og_description": "A vision for fashion without overproduction: your design, one day made autonomously from recycled clothing. Become part of the movement.",

      // ── Navigation ──
      "nav.skip": "Skip to content",
      "nav.aria": "Main navigation",
      "nav.production": "Production",
      "nav.lang_aria": "Switch language",
      "nav.community": "Community",
      "nav.enter": "Enter UR Create",

      // ── UR Create directive (Hero · UR Create · Ownership · Gallery · Problem · Alternative · Vision · Join · Final) ──
      "urcreate.label": "[ UR CREATE ]",
      "urcreate.h2": "Your imagination comes first",
      "urcreate.intro": "Describe your idea and shape it until the piece is truly yours — style, shape, material.",
      "own.eyebrow": "[ YOUR MOMENT ]",
      "own.headline_html": "This design exists <em>because you created it.</em>",
      "own.text": "Most fashion is created the other way around: millions of garments are produced before anyone asks for them. Urban Revolution believes creativity should come first.",
      "own.save": "Save my creation",
      "own.share": "Share",
      "own.publish": "Show in the gallery",
      "own.photoreal_html": "See it photoreal <span aria-hidden=\"true\">↓</span>",
      "own.why_html": "Discover why this matters <span aria-hidden=\"true\">↓</span>",
      "own.makereal_html": "Make it real — measurements &amp; production <span aria-hidden=\"true\">→</span>",
      "own.saved": "Saved to your collection.",
      "own.shared": "Link copied — share your creation.",
      "own.published": "Published to the community gallery.",
      "own.see_title": "See it on you.",
      "own.see_sub": "Pick one of the preview people — or upload your own full-body photo.",
      "own.stage_tag": "Your piece",
      "own.upload_own": "Upload your photo",
      "own.upload_hint": "Full body, straight posture. Your photo stays on your device until you start the preview.",
      "own.or_pick": "or",
      "own.presets_label": "Preview people",
      "own.preset_alt": "Preview person {n}",
      "own.info_title": "Your design",
      "own.info_type": "Type",
      "own.info_material": "Material",
      "own.info_color": "Color",
      "own.info_fit": "Fit",
      "own.info_length": "Length",
      "own.info_size": "Size",
      "own.edit_summary": "Adjust further",
      "own.edit_hint": "Changes apply instantly — regenerate the preview to see them on you.",
      "gal.label": "[ COMMUNITY ]",
      "gal.h2": "No two visions are the same",
      "gal.intro": "Creations from the community — view them, save them for inspiration, or remix one as the start of your own evolution.",
      "sphere.canvas_aria": "Floating community designs — drag or use arrow keys to rotate, tap or press Enter to open",
      "sphere.hint": "Drag or arrow keys · Tap or Enter",
      "sphere.cta": "Become part of it",
      "sphere.close": "Close",
      "sphere.detail_kicker": "Community creation",
      "sphere.by": "by",
      "sphere.detail_line": "A one-of-one from reclaimed cloth — designed in UR Create.",
      "sphere.detail_cta": "Create your own vision",
      "sphere.detail_remix": "Remix this piece",
      "sphere.detail_join": "Or join the community",
      "join.h2": "Together, this becomes a movement",
      "join.sub": "Join the people rethinking fashion — create alongside us, follow the journey, or bring your ideas.",
      "join.legend": "How would you like to take part?",
      "join.p1": "Create designs",
      "join.p2": "Follow the journey",
      "join.p3": "Contribute ideas",
      "join.p4": "Stay updated",
      "join.email_label": "Email address",
      "join.email_ph": "you@email.com",
      "join.cta": "Join Urban Revolution",
      "join.consent": "I'd like to receive updates (unsubscribe anytime). The privacy policy applies.",
      "join.ok": "Welcome to the revolution. We'll be in touch.",
      "join.err_email": "Please enter a valid email address.",
      "join.err_consent": "Please confirm consent.",
      "join.err": "Something went wrong. Please try again later.",

      // ── Hero ──

      // ── Begin experience (cursor-first opening — no selling, just begin) ──

      // ── Guided funnel (help-me-decide) ──

      // ── Manifesto (compact thesis after the hero) ──

      // ── Section labels (Ovyon-style [ NN / Title ] kicker) ──
      "sec.measure": "[ Your measurements ]",
      "sec.production": "[ Production ]",
      "sec.faq": "[ FAQ ]",

      // ── Facts block (consolidated [ 01 / The Problem ]) ──

      // ── Live waste counter (ticker, C+A) ──
      "ticker.unit": "kg",
      "ticker.live": "Live",
      "ticker.live_rate": "Live · every second +2'918 kg",
      "ticker.cap_full": "of textiles burned or buried, since you arrived.",
      "ticker.cap_short": "burned or buried · since you arrived",
      "ticker.source": "[ Source: UNEP · 92 M t / year ]",

      // ── Visual Scroll Story (6 acts) ──
      // Live counter (acts I–IV)

      // ── The true cost (fast-fashion evidence band) ──

      // ── Trust strip ──

      // ── How it works (3-step) ──

      // ── Workflow ──

      // ── Design section ──
      "design.prompt_label": "Your prompt for the AI",
      "design.prompt_placeholder": "e.g.: An oversized streetwear hoodie in heavy organic cotton fleece, in a dark olive tone with graphic embroidery on the chest, wide sleeves, kangaroo pocket and a lined hood...",
      "design.suggestions_inspiration": "Inspiration",
      "design.suggestions_foryou": "For you",
      "design.library_trigger": "My designs",
      "design.garment_label": "Garment type",
      "design.generate_btn": "Generate design",
      "design.generate_loading": "Your design takes shape...",

      // ── Garment types ──
      "type.tshirt": "T-Shirt",
      "type.hoodie": "Hoodie",
      "type.shirt": "Shirt",
      "type.pants": "Pants",
      "type.jacket": "Jacket",
      "type.dress": "Dress",

      // ── Materials ──
      "material.cotton": "Organic cotton",
      "material.linen": "Linen",
      "material.denim": "Denim",
      "material.wool": "Wool",
      "material.fleece": "Fleece",
      "material.silk": "Silk",
      "material.polyester": "Recycled polyester",

      // ── Fit ──
      "fit.slim": "Slim",
      "fit.regular": "Regular",
      "fit.oversized": "Oversized",

      // ── Length ──
      "length.cropped": "Cropped",
      "length.regular": "Regular",
      "length.long": "Long",

      // ── Preview chips: dimension micro-labels ──
      "chip.style": "Style",
      "chip.fit": "Fit",
      "chip.length": "Length",
      "chip.material": "Fabric",
      "chip.pattern": "Pattern",
      "engine.dock_aria": "Jump to the preview",

      // ── Design Engine (journey) ──
      "engine.back": "Back",
      "engine.skip": "Skip",
      "engine.finish_early": "Done",
      "engine.phase_aria": "Design phase",
      "engine.phase_feeling": "Feeling",
      "engine.phase_form": "Form",
      "engine.phase_fabric": "Fabric",
      "engine.phase_color": "Color",
      "engine.phase_details": "Details",
      "engine.confirm": "Next",
      "engine.regions_hint": "Tap a point on the piece and choose — or keep it all as is.",
      "engine.regions_accept": "Fine as is — next",
      "engine.region_unset": "still open",
      "engine.region_close": "Close",
      "engine.region_current": "current",
      "engine.scheme_mono": "Solid",
      "engine.scheme_duo": "Gradient",
      "engine.duo_hint": "Tap two fabrics — the order sets the gradient.",
      "engine.generate": "Generate design",
      "engine.generating": "Generating …",
      "engine.regenerate": "Regenerate — more bespoke",
      "engine.fallback_summary": "Rather describe it in words?",
      "engine.restart": "Start over",
      "engine.refine_title": "Your design",
      "engine.concepts_title": "Four directions from your decisions — pick one or evolve it",
      "engine.concepts_hint": "Each card is its own evolution path. \"Evolve\" creates the next version — for as long as you like.",
      "engine.evolve": "Evolve",
      "engine.evolved": "Version {v}",
      "engine.evolve_back_aria": "One version back",
      "engine.concept_original": "Original",
      "engine.concept_picked": "Direction applied",
      "engine.concept_pick_aria": "Select concept {n}",
      "concept.warmer": "Warmer",
      "concept.cooler": "Cooler",
      "concept.slimmer": "Slimmer",
      "concept.wider": "Roomier",
      "concept.sheen": "More sheen",
      "concept.matte": "More matte",
      "concept.pattern": "Bolder pattern",
      "concept.cleaner": "Calmer",
      "concept.len_cropped": "Cropped",
      "concept.len_regular": "Hip length",
      "concept.len_long": "Longer",
      "concept.subtle": "Subtle shift",
      "engine.refine_inferred": "Filled in from your style",
      "engine.refine_adjust": "Adjust — warmer / colder",
      "engine.deeper": "Refine deeper",
      "engine.nudge_down": "less",
      "engine.nudge_up": "more",
      "engine.changed_color": "Colourway",
      "engine.rank_up": "move up",
      "engine.rank_down": "move down",
      "engine.changed_details": "Details",
      "engine.share": "Share",
      "engine.share_copied": "Link copied",
      "engine.intro_title": "Find what you're looking for.",
      "engine.intro_sub": "No description needed — choose, compare, feel. Your piece takes shape from your decisions. At the very end, one sentence adds the final touch — the one the AI is meant to make your one-of-one from.",
      "engine.intro_start": "Begin",
      "engine.load_fail": "The journey couldn't be loaded. Please reload the page.",
      "engine.refine_freetext_label": "Anything we couldn't read from your choices? Add it in one sentence.",
      "engine.refine_freetext_ph": "e.g. hidden placket, inside pocket for a phone …",

      // ── VTO ──
      "vto.btn": "Generate photorealistic preview",
      "vto.disclaimer": "Sends your photo + the design description to Replicate (FLUX Kontext) for photorealistic generation. External API, ~10 seconds wait.",
      "vto.modal_close": "Close",
      "vto.generating": "Generating photorealistic preview...",
      "vto.result_alt": "Photorealistic preview",
      "vto.download": "Save image",
      "vto.hint_no_photo": "Pick a person or upload your photo",
      "vto.hint_no_design": "Generate a design first",
      "vto.hint_limit": "Demo limit reached ({limit}/{limit}) — contact us for more",
      "vto.hint_ready_first": "Click generates your photorealistic preview ({limit} per browser)",
      "vto.hint_ready_remaining": "Click generates your photorealistic preview ({remaining} of {limit} left)",
      "vto.status_sending": "Sending request to Replicate...",
      "vto.error_pending": "Generation is taking longer than expected (>20 s) — server limit reached. Please try again or at a different time.",
      "vto.error_unexpected": "Unexpected response from the server.",
      "vto.error_prefix": "Error: {msg}",
      "vto.error_network": "Network error: {msg}",

      // ── Generic, neutral service errors (edge-function codes) ──
      "err.service_unavailable": "The image service is currently unavailable. Please try again later.",
      "err.rate_limited": "A lot of requests are coming in right now — please try again in a minute.",
      "err.failed": "Generation failed. Please try again.",

      // ── Library ──
      "library.title": "My designs",
      "library.close": "Close",
      "library.empty": "No saved designs yet. Create one and press “Save” in the design card.",
      "library.count": "{n} of {max} designs saved",
      "library.load": "Load",
      "library.delete": "Delete",

      // ── Measurements section ──
      "measure.h2": "Your body measurements",
      "measure.intro": "So your garment fits perfectly, we need your exact measurements.",
      "meas.note": "Measurements are an estimate and stay adjustable anytime.",
      "measure.photo_h4": "Measurements from photo",
      "measure.photo_body": "Upload a full-body photo (standing straight, T-pose or arms slightly to the side). MediaPipe analyzes the pose and estimates your measurements automatically.",
      "measure.photo_privacy": "100% client-side — your image never leaves your device.",
      "measure.photo_btn": "Choose photo",
      "measure.photo_btn_loading": "Loading model...",
      "measure.photo_btn_analyzing": "Analyzing...",
      "measure.photo_btn_another": "Choose another photo",
      "measure.status_detecting": "Detecting pose...",
      "measure.status_no_pose": "No pose detected.",
      "measure.status_no_feet": "Feet not in frame — please use a new photo",
      "measure.status_error": "Error — please try again.",
      "measure.status_result": "{chest}cm chest · {waist}cm waist · {hips}cm hips",
      "measure.size_label": "Recommended size",
      "measure.detail_toggle": "Adjust detailed measurements",
      "measure.jump_aria": "{label} – jump to input field",
      "measure.range_error": "{label}: must be between {min} and {max} {unit}",
      "measure.figure_hint": "Tap a marker to edit that measurement",

      // ── Presets ──
      "preset.s": "Preset S",
      "preset.m": "Preset M",
      "preset.l": "Preset L",
      "preset.xl": "Preset XL",

      // ── Measurement labels ──
      "ml.height": "Height",
      "ml.weight": "Weight",
      "ml.chest": "Chest",
      "ml.waist": "Waist",
      "ml.hips": "Hips",
      "ml.shoulder": "Shoulder width",
      "ml.arm": "Arm length",
      "ml.inseam": "Inseam",
      "ml.neck": "Neck",

      // ── Body diagram (SVG) ──
      "svg.body_aria": "Body measurement diagram",
      "svg.shoulder": "Shoulder",
      "svg.chest": "Chest",
      "svg.waist": "Waist",
      "svg.hips": "Hips",
      "svg.inseam": "Inseam",
      "svg.height": "Height",

      // ── Photorealistic preview ──
      "preview.example_tag": "Example",

      // ── Design preview (AI studio render in the design step) ──
      "dpreview.fallback_badge": "STYLE PREVIEW",
      "dpreview.genesis_badge": "TAKING SHAPE …",

      // ── Production ──
      "prod.h2": "Production spec",
      "prod.intro": "Your design concept with all measurements and details — ready for the day we manufacture.",
      "spec.brief_h4": "Design brief",
      "spec.drawing_h4": "Technical drawing — front view",
      "spec.drawing_note": "Parametric drawing built from your decisions — proportions follow your measurements.",
      "spec.specs_h4": "Specifications",
      "spec.type": "Garment type",
      "spec.material": "Material",
      "spec.color": "Primary color",
      "spec.fit": "Fit",
      "spec.length": "Length",
      "spec.print": "Print",
      "spec.size": "Size",
      "spec.measures_h4": "Measurements (cm)",
      "spec.notes_h4": "Construction notes for production",
      "spec.id_prefix": "Design ID: {id}",
      "export.h3": "Your design, documented",
      "export.intro": "Download your design concept — or be first when production opens.",
      "export.json": "Download JSON data",
      "export.html": "Printable spec (HTML)",
      "export.print": "Print directly",
      "export.send": "Be first when production opens",
      "export.original_prompt": "Original prompt",
      "export.tags": "Tags",
      "export.body_measures": "Body measurements",
      "export.production_data": "Production data",
      "export.est_fabric": "Estimated fabric",
      "export.est_seams": "Estimated seam length",
      "export.duration": "Production time",
      "export.price_range": "Price range",
      "export.footer": "Generated by Urban Revolution — autonomous circular factory",
      "est.time_label": "Production:",
      "est.price_label": "Price:",
      "est.days": "{n} days",
      "est.future": "Expected after launch",
      "est.price_planned": "Indicative (planned)",
      "prod.placeholder_desc": "No design generated yet. Describe your desired outfit above.",
      "prod.placeholder_note": "Generate a design first to get construction notes.",
      "prod.placeholder_name": "Untitled Design",

      // ── FAQ ──
      "faq.h2": "FAQ",
      "faq.intro": "Everything you want to know before you join the vision.",
      "faq.q1": "How long does production take?",
      "faq.a1": "Nothing is made yet — we're building the factory that makes it possible. Once production starts, we'll state binding timelines here. Until then: no promises we can't keep.",
      "faq.q2": "What happens to my photo?",
      "faq.a2": "For measurement detection everything runs directly in your browser via MediaPipe — the photo never leaves your device and isn't stored. Only if you explicitly request the photorealistic preview is the photo sent once to Replicate (US servers) and immediately discarded after generation.",
      "faq.q3": "What does a piece cost?",
      "faq.a3": "Not set yet — prices will exist only once we actually manufacture. Be there and you'll be the first to know.",
      "faq.q4": "What if I haven't been measured?",
      "faq.a4": "Three ways to your measurements — photo analysis (1 click, 100% client-side), manual entry of the 9 values, or a size preset (S/M/L/XL) as a starting point you can adjust afterwards. Your measurements belong to your design and are ready the moment manufacturing starts.",
      "faq.q5": "Where is it made?",
      "faq.a5": "In the planned fully autonomous circular factory that sorts discarded textiles and makes your one-of-a-kind piece from them. Sign up — you'll be the first to know when and where it happens.",
      "faq.q6": "Can I order saved designs later?",
      "faq.a6": "Your designs stay saved in your library (locally in your browser). You'll be able to order them once we go live — just bring them back up again.",

      // ── Footer ──
      "footer.tagline": "You design. Autonomous robots make. You wear.",
      "footer.aria_atelier": "Create",
      "footer.aria_more": "More",
      "footer.col_atelier": "Create",
      "footer.design_start": "Start designing",
      "footer.measure": "Body measurements",
      "footer.col_more": "More",
      "footer.code": "Code (open source)",
      "footer.contact": "Contact",
      "footer.imprint": "Imprint",
      "footer.privacy": "Privacy",
      "footer.credits": "Image credits",
      "footer.top": "Back to top",
      "footer.meta_html": '© 2026 Urban Revolution · Fully autonomous circular factory · <a href="impressum.html">Imprint</a> · <a href="datenschutz.html">Privacy</a> · Made with <span aria-label="Love">♥</span> and AI',
      "footer.meta_fine": "Pre-launch vision · GDPR-compliant · Photo analysis 100% client-side",

      // ── Design card (dynamic) ──

      // ── Color names ──
      "color.#1a1a1a": "Black",
      "color.#ffffff": "White",
      "color.#7c2d12": "Deep red",
      "color.#1e3a8a": "Navy",
      "color.#365314": "Olive",
      "color.#a16207": "Caramel",
      "color.#831843": "Burgundy",
      "color.#6b21a8": "Violet",
      "color.#f59e0b": "Sun yellow",
      "color.#dc2626": "Red",
      "color.custom": "Custom",
      // Engine patterns (design journey) — chip fallback when no card label matches
      "pattern.stripe": "Stripes",
      "pattern.check": "Check",
      "pattern.graphic": "Graphic",
      "pattern.abstract": "Abstract",
      "pattern.solid": "Solid",
      "pattern.stripes_h": "Horizontal stripes",
      "pattern.stripes_v": "Vertical stripes",
      "pattern.dots": "Dots",
      "pattern.plaid": "Plaid",
      "pattern.camo": "Camo",
      "pattern.gradient": "Gradient",
      "pattern.heather": "Heather",
      "pattern.floral": "Floral",

      // ── Suggestions (dynamic) ──
      "sugg.foryou_count": "{n} design{s} created",
      "sugg.try_prefix": "Try: {label}",
      "sugg.minimal_label": "Minimal Tee",
      "sugg.minimal_prompt": "Minimalist black slim-fit T-shirt in pima cotton with a crew neck, slightly fitted",
      "sugg.cyber_label": "Cyber Hoodie",
      "sugg.cyber_prompt": "Oversized cyberpunk hoodie in neon purple with reflective stripes, cropped cut, drawstring hood",
      "sugg.oxford_label": "Oxford Shirt",
      "sugg.oxford_prompt": "Classic white Oxford shirt with button-down collar, long sleeves, slightly fitted, in 100% Egyptian cotton",
      "sugg.wide_label": "Wide-Leg Denim",
      "sugg.wide_prompt": "High-rise wide-leg jeans in indigo selvedge denim, vintage wash, five pockets, button fly",

      // ── Prompt builders (dynamic, {color}/{mat}) ──
      "pb.tshirt": "Simple {color} T-shirt in {mat}, slim fit, crew neck, slightly fitted",
      "pb.hoodie": "Oversized {color} hoodie in {mat}, with kangaroo pocket and hood, streetwear style",
      "pb.shirt": "Classic {color} shirt in {mat} with button-down collar, long sleeves, slightly fitted",
      "pb.pants": "High-rise {color} trousers in {mat}, wide-leg cut, classic fit, five pockets",
      "pb.jacket": "{color} jacket in {mat}, classic cut with zipper and stand collar",
      "pb.dress": "{color} midi dress in {mat}, A-line cut, sleeveless, elegant",

      // ── Toasts (dynamic) ──
      "toast.empty_prompt": "Please describe the design you want",
      "toast.generated": 'Design "{name}" generated!',
      "toast.gen_error": "Generation failed. Please try again.",
      "toast.need_design": "Please generate a design first",
      "toast.preset_loaded": "Preset {p} loaded",
      "toast.no_person": "No person detected in the photo — please use a full-body shot",
      "toast.no_feet": "The photo needs the full body (incl. feet) for correct measurements",
      "toast.photo_skin": "Measurements + skin tone taken from photo",
      "toast.photo_only": "Measurements taken from photo — review & fine-tune if needed",
      "toast.photo_failed": "Photo analysis failed: {msg}",
      "toast.json_done": "JSON file downloaded",
      "toast.html_done": "Printable spec downloaded",
      "toast.not_found": "Design not found",
      "toast.loaded": '"{name}" loaded',
      "toast.deleted": '"{name}" deleted',
      "toast.ai_fallback": "Claude API unreachable ({reason}) — using local generator",
      "lib.loaded_desc": "Loaded from your library",

      // ── AI-generated content (ai.js) ──
      "ai.fallback_desc": "Locally generated design based on prompt keywords",
      "ainame.tshirt": "Tee",
      "ainame.hoodie": "Hoodie",
      "ainame.shirt": "Shirt",
      "ainame.pants": "Pants",
      "ainame.jacket": "Jacket",
      "ainame.dress": "Dress",
      "ainame.fallback": "Piece",
      "notes.tshirt": [
        "Crew neck with 2cm ribbed neckband",
        "Side seams with double topstitch for durability",
        "2.5cm folded and topstitched hem",
        "Shoulder seam reinforced with contrast tape",
      ],
      "notes.hoodie": [
        "Double-layer hood with lined interior",
        "Kangaroo pocket with two side openings",
        "Rib-knit cuffs at hem and sleeves, 6cm",
        "Drawcord channel with metal eyelets and 1cm flat cord",
      ],
      "notes.shirt": [
        "Button-down collar with interlining",
        "3cm placket, 7 buttons of 11mm mother-of-pearl",
        "Double cuff with two buttons",
        "Back yoke with 4cm center pleat",
        "French seams at sides and sleeve set-in",
      ],
      "notes.pants": [
        "Classic five-pocket construction",
        "YKK metal zipper, button closure at waistband",
        "Rise front 22cm, back 28cm (mid-rise)",
        "Hem chain-stitched for an authentic look",
      ],
      "notes.jacket": [
        "Full lining with interior pockets (left, right)",
        "Subtle 8mm shoulder padding",
        "Lapel collar with buttonhole embroidery",
        "Two flap pockets",
        "Sleeve placket with 3 buttons",
      ],
      "notes.dress": [
        "Concealed zipper at the back, YKK 50cm",
        "Bust darts and waist princess seams",
        "5cm double-folded hem, blind-stitched",
      ],

      // ── Landing page (landing.html) — standalone brand landing ──
      "landing.eyebrow": "Autonomous Circular Factory",
      "landing.h1_line1": "Made for one.",
      "landing.h1_line2": "Not for all.",
      "landing.sub": "One-of-a-kind pieces of your own design, made to measure — from clothing that already exists. No overproduction. No waste. Only yours.",
      "landing.scroll": "Scroll",
      // Act I — The Line (manifesto + numbers speak the machine voice)
      "landing.manifesto_label": "Act I — The Line",
      "landing.manifesto": "Fashion became a line. Produce, wear, discard — one direction, one end. The line is fast. The line is cheap. And the line makes for all — never for you.",
      "landing.verbs": "Produce — Wear — Discard",
      // Act II — The Circle (the vision, serif voice)
      "landing.loop_label": "Act II — The Circle",
      "landing.loop_status": "Status: vision — not yet built",
      "landing.loop_title": "Four stations. One circle.",
      "landing.loop_sub": "A factory whose conveyor has no end. This is its blueprint.",
      "landing.loop_aria": "The four stations of the loop",
      "landing.stage1_title": "Worn",
      "landing.stage1_tag": "All",
      "landing.stage1_text": "Every piece starts as clothing with a history — collected instead of landfilled.",
      "landing.stage2_title": "Reclaimed",
      "landing.stage2_tag": "AI",
      "landing.stage2_text": "Fabric, buttons, seams: what's thrown away is meant to be sorted autonomously into raw material for something new.",
      "landing.stage3_title": "Designed",
      "landing.stage3_tag": "You",
      "landing.stage3_text": "You design your piece — your style, your idea, to your measurements.",
      "landing.stage4_title": "Reborn",
      "landing.stage4_tag": "AI",
      "landing.stage4_text": "A fully autonomous factory will make your piece — one garment for one person.",
      "landing.stats_label": "The line, on record",
      "landing.stats_title": "Where the line leads",
      "landing.stat1_label": "of clothing is recycled into new clothing",
      "landing.stat1_kicker": "Return",
      "landing.stat2_label": "truckload of textiles is landfilled or burned every single second",
      "landing.stat2_kicker": "Discard",
      "landing.stat3_label": "of global CO₂ emissions come from the fashion industry",
      "landing.stat3_kicker": "Produce",
      "landing.facts_coda": "Less than one percent finds its way back. A line knows no way back — only onward.",
      "landing.stats_src_html": "Sources: <a href=\"https://www.ellenmacarthurfoundation.org/a-new-textiles-economy\" target=\"_blank\" rel=\"noopener\">Ellen MacArthur Foundation</a> · <a href=\"https://www.unep.org/news-and-stories/story/putting-brakes-fast-fashion\" target=\"_blank\" rel=\"noopener\">UNEP</a>",
      "factsB.co2_year": "≈ 1.2 billion tonnes of CO₂ per year",
      "factsB.co2_since": "t of CO₂ since you arrived",
      "factsB.co2_compare": "more than international flights (≈ 2%) and maritime shipping (≈ 2%) combined",
      "factsB.truck_rate": "1 truckload / second",
      "factsB.return_note": "Out of 100 garments, not even one makes it back.",
      "landing.cta_title_html": "Wear something that exists <em>only once</em>.",
      "landing.cta_sub": "Describe your idea — you design your piece, we make it. Made to measure, from recycled clothing.",
      "landing.handoff": "The circle is waiting for its first piece.",
      "landing.tap_hint": "Tap anywhere — the threads weave your next piece.",
      "landing.orb_aria": "Start UR Create — opens the studio",
      "landing.portal_opening": "Opening the studio …",

      // ── The turn (#pivot) — the line bends into a circle ──
      "pivot.label": "The turn",
      "pivot.question": "And what if there were a way back?",
      "pivot.hinge": "We bend the line back into a circle.",
      "pivot.mission": "Our mission: the end of the straight line. What the line throws away is meant to become material — for the opposite of mass.",

      // ── AI, done right (landing beat #4) ──
      "aidr.label": "AI, done right",
      "aidr.h2_html": "AI can <em>speed up</em> the line. Or <em>close</em> the circle.",
      "aidr.dim_tag": "On the line",
      "aidr.dim_h": "Predict, push, repeat",
      "aidr.dim_p": "Recommendation engines tuned to make you buy the next thing, faster. AI that feeds the line — manufacturing new wants.",
      "aidr.lit_tag": "In the circle",
      "aidr.lit_h": "See, separate, reclaim",
      "aidr.lit_p": "AI aimed at the discard pile: it is meant to untangle what was thrown away so it can live again.",
      "aidr.body_html": "The hard problem in the circle was never the sewing — it is untangling the discarded: mixed fibres, fastenings, seams, dyes. A pile no human line can sort at scale. That is exactly where the machine is meant to work: <strong>sort the fabric and build the piece. Nothing more.</strong> The design stays yours — you set the style, you make every decision. <strong>The AI never designs.</strong>",

      // ── The centre (landing beat #2 — identity) ──
      "identity.label": "The centre",
      "identity.h2_html": "At the centre of this circle: <em>you</em>.",
      "identity.body_html": "The line made for all — the same piece, a million times over, in a size that belongs to no one. The circle turns the other way: around you. <strong>Identity isn't chosen from options. It's made.</strong>",
      "how.label": "How it works",
      "how.title": "Four steps along your arc",
      "how.sub": "This is your side of the circle — from the first sentence to a documented blueprint. You hold the thread, the machine holds the needle.",
      "how.s1_label": "You design",
      "how.s1_line": "One sentence is enough. The idea is yours — and stays yours.",
      "how.s2_label": "You decide",
      "how.s2_line": "The engine asks, you choose: cut, fabric, colour. Every answer sharpens your piece.",
      "how.s3_label": "Your measurements",
      "how.s3_line": "Nine body measurements — by photo right in your browser, by hand, or from a preset. An estimate, adjustable anytime.",
      "how.s4_label": "Your blueprint",
      "how.s4_line": "A documented one-off — ready for the day the circle closes for the first time.",
      "how.anchor": "How it works",
    },
  };

  let current = loadLang();

  function loadLang() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && SUPPORTED.includes(saved)) return saved;
    } catch {
      /* localStorage blocked — fall through */
    }
    return DEFAULT_LANG;
  }

  function getLang() {
    return current;
  }

  function locale() {
    return current === "de" ? "de-DE" : "en-US";
  }

  // Resolve a key in the current language, with German as fallback, and the
  // raw key as last resort. {placeholder} tokens are filled from `vars`.
  function t(key, vars) {
    const table = dict[current] || dict[DEFAULT_LANG];
    let value = table[key];
    if (value === undefined) value = dict[DEFAULT_LANG][key];
    if (value === undefined) return key;
    if (Array.isArray(value)) return value; // notes.* tables
    if (vars) {
      value = String(value).replace(/\{(\w+)\}/g, (m, k) =>
        vars[k] !== undefined && vars[k] !== null ? vars[k] : m,
      );
    }
    return value;
  }

  // Convenience helpers for the keyed maps used across modules.
  function material(key) {
    return t("material." + key);
  }
  function measureLabel(key) {
    return t("ml." + key);
  }
  function typeLabel(key) {
    return t("type." + key);
  }
  function colorName(hex) {
    const k = "color." + String(hex).toLowerCase();
    const v = t(k);
    return v === k ? t("color.custom") : v;
  }
  function pattern(key) {
    return t("pattern." + key);
  }

  // Translate every element carrying an i18n attribute within `root`.
  function apply(root = document) {
    root.querySelectorAll("[data-i18n]").forEach((el) => {
      el.textContent = t(el.getAttribute("data-i18n"));
    });
    root.querySelectorAll("[data-i18n-html]").forEach((el) => {
      // The value is a static, developer-authored entry from the I18N dictionary
      // in this file (never user input), so the trusted inline markup it carries
      // (<br>, <em>, <strong>, <span>, source <a>) is intentional and safe to
      // inject. Do NOT switch this to textContent (renders tags as literal text)
      // or to a sanitizer that isn't loaded — both break every rich-text string.
      el.innerHTML = t(el.getAttribute("data-i18n-html"));
    });
    root.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      el.setAttribute("placeholder", t(el.getAttribute("data-i18n-placeholder")));
    });
    root.querySelectorAll("[data-i18n-aria-label]").forEach((el) => {
      el.setAttribute("aria-label", t(el.getAttribute("data-i18n-aria-label")));
    });
    root.querySelectorAll("[data-i18n-alt]").forEach((el) => {
      el.setAttribute("alt", t(el.getAttribute("data-i18n-alt")));
    });
    root.querySelectorAll("[data-i18n-title]").forEach((el) => {
      el.setAttribute("title", t(el.getAttribute("data-i18n-title")));
    });
    document.documentElement.setAttribute("lang", current);
    document.title = t("head.title");
    // Keep the search/social meta in sync with the active language, so a crawler
    // or share-scrape of the toggled (EN) state gets a right-language snippet and
    // share card instead of the German default. (Full per-language indexability
    // still needs distinct URLs; this fixes the toggled-state metadata.)
    setMetaKey('meta[name="description"]', "meta.description");
    setMetaKey('meta[property="og:title"]', "meta.og_title");
    setMetaKey('meta[name="twitter:title"]', "meta.og_title");
    setMetaKey('meta[property="og:description"]', "meta.og_description");
    setMetaKey('meta[name="twitter:description"]', "meta.og_description");
    setMeta('meta[property="og:locale"]', current === "en" ? "en_US" : "de_DE");
  }

  // Set a <head> meta tag's content if the tag exists. setMetaKey resolves an
  // i18n key first and skips writing when the key is missing (t() echoes the key
  // back when absent — don't write that literal string into the markup).
  function setMeta(selector, value) {
    const el = document.head && document.head.querySelector(selector);
    if (el && value) el.setAttribute("content", value);
  }
  function setMetaKey(selector, key) {
    const value = t(key);
    if (value !== key) setMeta(selector, value);
  }

  function setLang(lang) {
    if (!SUPPORTED.includes(lang) || lang === current) return;
    current = lang;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* ignore */
    }
    apply();
    window.dispatchEvent(new CustomEvent("language:change", { detail: { lang } }));
  }

  // Translate the static DOM as soon as it's parsed so a saved EN preference
  // takes effect before first paint of dynamic content.
  function init() {
    apply();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  return {
    SUPPORTED,
    getLang,
    setLang,
    locale,
    t,
    material,
    measureLabel,
    typeLabel,
    colorName,
    pattern,
    apply,
    // Exposed for the DE/EN key-parity test (read-only data); harmless in the
    // browser. Lets tooling diff the two language tables without re-parsing.
    dict,
  };
})();

if (typeof window !== "undefined") window.I18N = I18N;
if (typeof module !== "undefined" && module.exports) module.exports = I18N;
