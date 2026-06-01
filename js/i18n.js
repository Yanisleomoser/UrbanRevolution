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
      "head.title": "Urban Revolution — Maßgeschneiderte AI-Couture aus Zürich",

      // ── Navigation ──
      "nav.skip": "Zum Inhalt springen",
      "nav.aria": "Hauptnavigation",
      "nav.toggle_open": "Menü öffnen",
      "nav.toggle_close": "Menü schließen",
      "nav.mission": "Mission",
      "nav.design": "Design",
      "nav.measure": "Maße",
      "nav.preview": "Vorschau",
      "nav.production": "Produktion",
      "nav.faq": "FAQ",
      "nav.lang_aria": "Sprache wechseln",

      // ── Hero ──
      "hero.eyebrow": "AI · ATELIER · COUTURE",
      "hero.title_html": 'Deine Vision.<br>Deine Maße.<br><span class="gradient-text">Deine Kleidung.</span>',
      "hero.subtitle": "Ein Satz genügt. Die KI entwirft dein Stück, eine fotorealistische Vorschau zeigt es an dir — Schneider bekommen die fertige Spec.",
      "hero.cta_html": 'Jetzt designen <span aria-hidden="true">→</span>',
      "hero.prompt_form_aria": "Kleidungsstück beschreiben und Design starten",
      "hero.prompt_aria": "Beschreibe dein Wunschkleidungsstück",
      "hero.prompt_placeholder_focus": "Tippe deine Idee …",
      "hero.prompt_go_text": "Designen",
      "hero.prompt_go_aria": "Design starten",
      "hero.microcopy_html": 'Tippe los — oder sieh zu, wie aus Worten ein Kleidungsstück wird.',
      "hero.vision_cta_html": 'Warum das wichtig ist <span aria-hidden="true">↓</span>',
      "hero.examples": [
        "ein oversized Hoodie in Sonnenuntergangsfarben",
        "ein fließendes Leinenkleid für laue Sommerabende",
        "eine Cyberpunk-Jacke in Neon-Lila mit Reflektoren",
        "ein minimalistisches schwarzes Slim-Fit T-Shirt",
        "ein langer Mantel in Tiefsee-Blau und Petrol",
        "ein Streetwear-Set in sattem Waldgrün",
      ],
      "hero.asset_alt": "Model in einem KI-designten Outfit, von Neon-Lichtspuren in Pink und Cyan umspielt",
      "hero.caption_html": "AI-generiert. Maßgeschneidert. In <strong>14 Tagen</strong> bei dir.",

      // ── Visual Scroll Story (6 acts) ──
      "story.heading": "Warum wir dieses System ändern müssen",
      "story.a0_kicker": "Akt I",
      "story.a0_headline_html": "Eine Flasche. Achtlos weggeworfen.",
      "story.a0_statement": "Sie überlebt deine Urenkel.",
      "story.a1_kicker": "Akt II",
      "story.a1_headline_html": "Dein altes Shirt verschwindet nicht.",
      "story.a1_statement": "Es wird zu diesem Berg.",
      "story.a2_kicker": "Akt III",
      "story.a2_headline_html": "Es reist weiter — an Orte, die du nie siehst.",
      "story.a2_statement": "Aber es bleibt nicht dort.",
      "story.a3_kicker": "Akt IV",
      "story.a3_headline_html": "Es kommt zurück. Als Staub, so fein, dass er die Haut durchdringt.",
      "story.a3_statement": "Im Blut von 4 aus 5 Menschen. Auch in deinem.",
      "story.a4_kicker": "Akt V",
      "story.a4_headline_html": "Es muss nicht so enden.<br>Dieselbe Faser kann etwas anderes werden.",
      "story.a4_statement": "Wenn Technologie nichts mehr fertigt, das niemand will.",
      "story.a5_kicker": "Akt VI",
      "story.a5_headline_html": "Aus geretteter Faser wird Couture — KI-entworfen, nach deinen Maßen.",
      "story.a5_statement": "Für einen gemacht. Deiner.",
      "story.cta_html": 'Mach dein erstes Stück <span aria-hidden="true">→</span>',
      "story.skip": "Direkt zum Design",
      "flair.egg": "✦ Revolution entdeckt.",
      // Live counter (acts I–IV)
      "story.counter_intro": "Seit du hier bist:",
      "story.counter_garments": "Kleidungsstücke produziert",
      "story.counter_trucks": "Lkw-Ladungen Textilien entsorgt",

      // ── Trust-Strip ──
      "trust.aria": "Markenmerkmale",
      "trust.t1_title": "Maßgefertigt",
      "trust.t1_body": "Jedes Stück nach deinen 9 Körpermaßen — keine Standardgrößen, kein Kompromiss",
      "trust.t2_title": "Designed in Zürich",
      "trust.t2_body": "Schweizer Atelier, transparente Produktion in CHF, faire Lieferzeit unter 14 Tagen",
      "trust.t3_title": "KI + Handwerk",
      "trust.t3_body": "Generative Designs treffen auf echte Schneider — kein Print-on-Demand, kein Fast-Fashion",
      "trust.t4_title": "100 % Privatsphäre",
      "trust.t4_body": "Maßerkennung clientseitig — dein Foto verlässt nie dein Gerät, außer du klickst opt-in",

      // ── Workflow ──
      "workflow.s1_html": "<span>1</span> Design",
      "workflow.s2_html": "<span>2</span> Maße",
      "workflow.s3_html": "<span>3</span> Vorschau",
      "workflow.s4_html": "<span>4</span> Produktion",

      // ── Design-Sektion ──
      "design.h2": "Beschreibe dein Design",
      "design.intro": "Erzähle der KI, was du tragen möchtest. Stil, Farbe, Material, Anlass — alles ist möglich.",
      "design.prompt_label": "Dein Prompt für die KI",
      "design.prompt_placeholder": "z.B.: Ein oversized Streetwear-Hoodie aus schwerem Bio-Baumwoll-Fleece, in einem dunklen Olivton mit graphischen Stickereien auf der Brust, weite Ärmel, mit Känguru-Tasche und gefüttert mit Kapuze...",
      "design.suggestions_inspiration": "Inspiration",
      "design.suggestions_foryou": "Für dich",
      "design.library_trigger": "Meine Designs",
      "design.garment_label": "Kleidungstyp",
      "design.generate_btn": "Design generieren",
      "design.generate_loading": "KI generiert...",
      "design.output_placeholder": "Dein KI-generiertes Design erscheint hier",
      "design.customize_h3": "Anpassungen",
      "design.primary_color": "Primärfarbe",
      "design.material_label": "Material",
      "design.pattern_label": "Muster",
      "design.fit_label": "Passform",

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

      // ── VTO ──
      "vto.btn": "Fotorealistische Vorschau generieren",
      "vto.disclaimer": "Sendet dein Foto + die Design-Beschreibung an Replicate (FLUX Kontext) für die fotorealistische Generierung. Externe API, ~10 Sekunden Wartezeit.",
      "vto.modal_close": "Schließen",
      "vto.generating": "Generiere fotorealistische Vorschau...",
      "vto.result_alt": "Fotorealistische Vorschau",
      "vto.download": "Bild speichern",
      "vto.hint_no_photo": 'Lade zuerst ein Foto unter "Maße" hoch',
      "vto.hint_no_design": "Generiere zuerst ein Design",
      "vto.hint_limit": "Demo-Limit erreicht ({limit}/{limit}) — kontaktiere uns für mehr",
      "vto.hint_ready_first": "Klick generiert deine fotorealistische Vorschau ({limit} pro Browser)",
      "vto.hint_ready_remaining": "Klick generiert deine fotorealistische Vorschau ({remaining} von {limit} übrig)",
      "vto.status_sending": "Sende Anfrage an Replicate...",
      "vto.error_pending": "Generierung läuft länger als erwartet (>20 s) — Server-Limit erreicht. Bitte erneut versuchen oder andere Uhrzeit probieren.",
      "vto.error_unexpected": "Unerwartete Antwort vom Server.",
      "vto.error_prefix": "Fehler: {msg}",
      "vto.error_network": "Netzwerkfehler: {msg}",

      // ── Bibliothek ──
      "library.title": "Meine Designs",
      "library.close": "Schließen",
      "library.empty": "Noch keine gespeicherten Designs. Erstelle eines und drücke „Speichern“ in der Design-Karte.",
      "library.count": "{n} von {max} Designs gespeichert",
      "library.load": "Laden",
      "library.delete": "Löschen",

      // ── Maße-Sektion ──
      "measure.h2": "Deine Körpermaße",
      "measure.intro": "Damit dein Kleidungsstück perfekt sitzt, brauchen wir deine genauen Maße.",
      "measure.photo_h4": "Maße aus Foto",
      "measure.photo_body": "Lade ein Ganzkörperfoto hoch (gerade stehend, T-Pose oder Arme leicht zur Seite). MediaPipe analysiert die Pose und schätzt deine Maße automatisch.",
      "measure.photo_privacy": "100% clientseitig — dein Bild verlässt nie dein Gerät.",
      "measure.photo_btn": "Foto auswählen",
      "measure.photo_btn_loading": "Lade Modell...",
      "measure.photo_btn_analyzing": "Analysiere...",
      "measure.photo_btn_another": "Anderes Foto auswählen",
      "measure.status_detecting": "Erkenne Pose...",
      "measure.status_no_pose": "Keine Pose erkannt.",
      "measure.status_no_feet": "Füße nicht im Bild — neues Foto bitte",
      "measure.status_error": "Fehler — bitte erneut versuchen.",
      "measure.status_result": "{chest}cm Brust · {waist}cm Taille · {hips}cm Hüfte",
      "measure.size_label": "Empfohlene Konfektionsgröße",
      "measure.detail_toggle": "Maße im Detail anpassen",
      "measure.jump_aria": "{label} – zum Eingabefeld springen",
      "measure.figure_hint": "Tippe eine Markierung, um den Wert anzupassen",

      // ── Voreinstellungen ──
      "preset.s": "Voreinstellung S",
      "preset.m": "Voreinstellung M",
      "preset.l": "Voreinstellung L",
      "preset.xl": "Voreinstellung XL",

      // ── Maß-Bezeichnungen ──
      "ml.height": "Körpergröße",
      "ml.weight": "Gewicht",
      "ml.chest": "Brustumfang",
      "ml.waist": "Taillenumfang",
      "ml.hips": "Hüftumfang",
      "ml.shoulder": "Schulterbreite",
      "ml.arm": "Armlänge",
      "ml.inseam": "Schrittlänge",
      "ml.neck": "Halsumfang",

      // ── Körperdiagramm (SVG) ──
      "svg.body_aria": "Maßdiagramm Körper",
      "svg.shoulder": "Schulter",
      "svg.chest": "Brust",
      "svg.waist": "Taille",
      "svg.hips": "Hüfte",
      "svg.inseam": "Schritt",
      "svg.height": "Körpergröße",

      // ── 3D-Vorschau ──
      "preview.h2": "Fotorealistische Vorschau",
      "preview.intro": "Sieh dein KI-Design auf einem echten Foto von dir — fotorealistisch generiert, nicht als Modell-Annäherung.",
      "preview.example_tag": "Beispiel",
      "preview.example_label": "So sieht dein KI-Design fotorealistisch an dir aus — lade unter „Maße“ ein Ganzkörperfoto hoch.",
      "preview.loading_h3": "3D-Vorschau wird geladen",
      "preview.loading_body": "Three.js initialisiert das interaktive Modell mit deinen Maßen. Falls dein Browser kein WebGL unterstützt, zeigen wir hier einen Hinweis.",
      "preview.model_info": "Modell-Info",
      "preview.fabric": "Stoffmenge:",
      "preview.seams": "Nähte:",
      "preview.size": "Größe:",

      // ── Produktion ──
      "prod.h2": "Produktions-Vorlage",
      "prod.intro": "Alle Daten, die der Schneider und die Produktion benötigen, in einem Dokument.",
      "spec.brief_h4": "Design Brief",
      "spec.specs_h4": "Spezifikationen",
      "spec.type": "Kleidungstyp",
      "spec.material": "Material",
      "spec.color": "Primärfarbe",
      "spec.fit": "Passform",
      "spec.size": "Konfektionsgröße",
      "spec.measures_h4": "Maße (cm)",
      "spec.notes_h4": "Schnitt-Notizen für den Schneider",
      "spec.id_prefix": "Design ID: {id}",
      "export.h3": "Bereit für die Produktion?",
      "export.intro": "Lade die Vorlage herunter oder sende sie direkt an die Schneiderei.",
      "export.json": "JSON Daten herunterladen",
      "export.html": "Druckbare Vorlage (HTML)",
      "export.print": "Direkt drucken",
      "export.send": "Auftrag an Produktion senden",
      "export.original_prompt": "Original Prompt",
      "export.tags": "Tags",
      "export.body_measures": "Körpermaße",
      "export.production_data": "Produktionsdaten",
      "export.est_fabric": "Geschätzte Stoffmenge",
      "export.est_seams": "Geschätzte Nahtlänge",
      "export.duration": "Produktionsdauer",
      "export.price_range": "Preisspanne",
      "export.footer": "Generiert von Urban Revolution AI Atelier",
      "export.order_confirmation": "Auftrag {id} wurde an die Produktion gesendet",
      "est.time_label": "Geschätzte Produktion:",
      "est.price_label": "Preisspanne:",
      "est.days": "{n} Tage",
      "prod.placeholder_desc": "Noch kein Design generiert. Beschreibe oben dein Wunsch-Outfit.",
      "prod.placeholder_note": "Generiere zuerst ein Design, um Schneider-Notizen zu erhalten.",
      "prod.placeholder_name": "Untitled Design",

      // ── FAQ ──
      "faq.h2": "Häufige Fragen",
      "faq.intro": "Alles was du wissen willst, bevor du dein erstes Stück bestellst.",
      "faq.q1": "Wie lange dauert die Produktion?",
      "faq.a1": "In der Regel 7 bis 14 Werktage zwischen Bestellung und Versand. Komplexere Stücke (mehrlagige Jacken, aufwändige Stickerei) können bis zu 21 Tage benötigen — die geschätzte Lieferzeit zeigen wir dir nach der Generierung.",
      "faq.q2": "Was passiert mit meinem Foto?",
      "faq.a2": "Für die Maßerkennung läuft alles direkt in deinem Browser über MediaPipe — das Foto verlässt nie dein Gerät und wird nicht gespeichert. Nur wenn du explizit die fotorealistische Vorschau anforderst, wird das Foto einmalig an Replicate (US-Server) gesendet und nach der Generierung sofort wieder verworfen.",
      "faq.q3": "Was kostet ein maßgeschneidertes Stück?",
      "faq.a3": "Der Preis hängt von Stofftyp, Schnittkomplexität und gewählten Maßen ab. Eine Spanne in CHF zeigen wir dir live in der Spec-Sheet-Vorschau — typisch CHF 145–220 für T-Shirts und Hemden, CHF 220–450 für Hosen und Jacken, CHF 380–680 für Mäntel und Kleider.",
      "faq.q4": "Was, wenn ich nicht gemessen wurde?",
      "faq.a4": "Drei Wege zu deinen Maßen — Foto-Auswertung (1 Klick, 100 % clientseitig), manuelle Eingabe der 9 Werte, oder eine Größenpresets (S/M/L/XL) als Startpunkt, die du danach anpassen kannst. Schneider erhalten alle Werte in der Produktions-Spec.",
      "faq.q5": "Wo wird gefertigt?",
      "faq.a5": "Aktuell arbeiten wir mit Schneider-Ateliers in der Schweiz und Norditalien zusammen — fair entlohnt, traceable Lieferketten, nachhaltige Materialien wo möglich. Für jede Bestellung sehen wir genau, wer welches Stück nach welcher Spec fertigt.",
      "faq.q6": "Kann ich gespeicherte Designs später nochmal bestellen?",
      "faq.a6": "Ja — alle Designs landen in deiner Bibliothek (lokal in deinem Browser), du kannst sie jederzeit wieder laden, anpassen und neu bestellen. Die fotorealistische Vorschau wird auf Wunsch automatisch ans Design angehängt.",

      // ── Footer ──
      "footer.tagline": "Maßgeschneiderte AI-Couture aus Zürich. KI entwirft, Schneider fertigen, du trägst.",
      "footer.aria_atelier": "Atelier",
      "footer.aria_more": "Mehr",
      "footer.col_atelier": "Atelier",
      "footer.design_start": "Design starten",
      "footer.measure": "Körpermaße",
      "footer.col_more": "Mehr",
      "footer.code": "Code (Open Source)",
      "footer.contact": "Kontakt",
      "footer.imprint": "Impressum",
      "footer.privacy": "Datenschutz",
      "footer.credits": "Bildnachweise",
      "footer.top": "Zum Seitenanfang",
      "footer.meta_html": '© 2026 Urban Revolution · Designed in Zürich · <a href="impressum.html">Impressum</a> · <a href="datenschutz.html">Datenschutz</a> · Hergestellt mit <span aria-label="Liebe">♥</span> und KI',
      "footer.meta_fine": "Preise in CHF · Produktion 7–14 Tage · DSGVO-konform · Foto-Auswertung 100 % clientseitig",

      // ── Design-Karte (dynamisch) ──
      "card.eyebrow": "KI-DESIGN · {id}",
      "card.fit_suffix": "Fit",
      "card.tailor_notes": "Schneider-Notizen ({n})",
      "card.your_wish": "Dein Wunsch",
      "card.save": "Speichern",
      "card.saved": "Gespeichert",
      "card.save_aria": "Design speichern",

      // ── Farbnamen ──
      "color.#1a1a1a": "Schwarz",
      "color.#ffffff": "Weiß",
      "color.#7c2d12": "Tiefrot",
      "color.#1e3a8a": "Marineblau",
      "color.#365314": "Olivgrün",
      "color.#a16207": "Karamell",
      "color.#831843": "Burgunder",
      "color.#6b21a8": "Violett",
      "color.#f59e0b": "Sonnengelb",
      "color.#dc2626": "Rot",
      "color.custom": "Custom",
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
      "sugg.oxford_prompt": "Klassisches weißes Oxford-Hemd mit Button-Down-Kragen, lange Ärmel, leicht tailliert, aus 100% ägyptischer Baumwolle",
      "sugg.wide_label": "Wide-Leg Denim",
      "sugg.wide_prompt": "Hochgeschnittene Wide-Leg Jeans aus Indigo Selvedge Denim, Vintage-Waschung, fünf Taschen, Knopfleiste",

      // ── Prompt-Vorlagen (dynamisch, {color}/{mat}) ──
      "pb.tshirt": "Schlichtes {color} T-Shirt aus {mat} im Slim-Fit, Rundhalsausschnitt, leicht tailliert",
      "pb.hoodie": "Oversized {color} Hoodie aus {mat}, mit Känguru-Tasche und Kapuze, Streetwear-Stil",
      "pb.shirt": "Klassisches {color} Hemd aus {mat} mit Button-Down-Kragen, langen Ärmeln, leicht tailliert",
      "pb.pants": "Hochgeschnittene {color} Hose aus {mat}, Wide-Leg-Schnitt, klassischer Cut, fünf Taschen",
      "pb.jacket": "{color} Jacke aus {mat}, klassischer Schnitt mit Reißverschluss und Stehkragen",
      "pb.dress": "{color} Midi-Kleid aus {mat}, A-Linien-Schnitt, ärmellos, elegant",

      // ── Toasts (dynamisch) ──
      "toast.empty_prompt": "Bitte beschreibe dein gewünschtes Design",
      "toast.generated": 'Design "{name}" generiert!',
      "toast.gen_error": "Fehler bei der Generierung. Bitte erneut versuchen.",
      "toast.need_design": "Bitte zuerst ein Design generieren",
      "toast.preset_loaded": "Voreinstellung {p} geladen",
      "toast.no_person": "Keine Person im Foto erkannt — bitte Ganzkörper-Aufnahme",
      "toast.no_feet": "Foto braucht den ganzen Körper (inkl. Füße) für korrekte Maße",
      "toast.photo_skin": "Maße + Hautton aus Foto übernommen",
      "toast.photo_only": "Maße aus Foto übernommen — überprüfe & feinjustiere bei Bedarf",
      "toast.photo_failed": "Foto-Analyse fehlgeschlagen: {msg}",
      "toast.json_done": "JSON-Datei heruntergeladen",
      "toast.html_done": "Druckbare Vorlage heruntergeladen",
      "toast.order_sending": "Auftrag wird übermittelt...",
      "toast.order_done": "✓ {confirmation}. Lieferung ca. {date}",
      "toast.save_failed": "Speichern fehlgeschlagen",
      "toast.saved_lib": '"{name}" in deiner Bibliothek gespeichert',
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
        "Reißverschluss YKK Metall, Knopfverschluss am Bund",
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
        "Verdeckter Reißverschluss am Rücken, YKK 50cm",
        "Brustabnäher und Taillen-Princessnähte",
        "Saum 5cm doppelt umgeschlagen, blind gesteppt",
      ],
    },

    en: {
      // ── <head> ──
      "head.title": "Urban Revolution — Made-to-measure AI couture from Zurich",

      // ── Navigation ──
      "nav.skip": "Skip to content",
      "nav.aria": "Main navigation",
      "nav.toggle_open": "Open menu",
      "nav.toggle_close": "Close menu",
      "nav.mission": "Mission",
      "nav.design": "Design",
      "nav.measure": "Measurements",
      "nav.preview": "Preview",
      "nav.production": "Production",
      "nav.faq": "FAQ",
      "nav.lang_aria": "Switch language",

      // ── Hero ──
      "hero.eyebrow": "AI · ATELIER · COUTURE",
      "hero.title_html": 'Your vision.<br>Your measurements.<br><span class="gradient-text">Your clothing.</span>',
      "hero.subtitle": "One sentence is enough. The AI designs your piece, a photorealistic preview shows it on you — tailors get the finished spec.",
      "hero.cta_html": 'Start designing <span aria-hidden="true">→</span>',
      "hero.prompt_form_aria": "Describe a garment and start designing",
      "hero.prompt_aria": "Describe the garment you want",
      "hero.prompt_placeholder_focus": "Type your idea …",
      "hero.prompt_go_text": "Design",
      "hero.prompt_go_aria": "Start designing",
      "hero.microcopy_html": 'Start typing — or watch words become a garment.',
      "hero.vision_cta_html": 'Why this matters <span aria-hidden="true">↓</span>',
      "hero.examples": [
        "an oversized hoodie in sunset colours",
        "a flowing linen dress for warm summer evenings",
        "a cyberpunk jacket in neon purple with reflectors",
        "a minimalist black slim-fit t-shirt",
        "a long coat in deep-sea blue and petrol",
        "a streetwear set in rich forest green",
      ],
      "hero.asset_alt": "Model in an AI-designed outfit, wrapped in pink and cyan neon light trails",
      "hero.caption_html": "AI-generated. Made to measure. At your door in <strong>14 days</strong>.",

      // ── Visual Scroll Story (6 acts) ──
      "story.heading": "Why this system has to change",
      "story.a0_kicker": "Act I",
      "story.a0_headline_html": "One bottle. Carelessly thrown away.",
      "story.a0_statement": "It outlives your great-grandchildren.",
      "story.a1_kicker": "Act II",
      "story.a1_headline_html": "Your old shirt doesn't disappear.",
      "story.a1_statement": "It becomes this mountain.",
      "story.a2_kicker": "Act III",
      "story.a2_headline_html": "It travels on — to places you'll never see.",
      "story.a2_statement": "But it doesn't stay there.",
      "story.a3_kicker": "Act IV",
      "story.a3_headline_html": "It comes back. As dust fine enough to cross the skin.",
      "story.a3_statement": "In the blood of 4 in 5 people. In yours, too.",
      "story.a4_kicker": "Act V",
      "story.a4_headline_html": "It doesn't have to end this way.<br>The same fibre can become something else.",
      "story.a4_statement": "When technology makes nothing no one wants.",
      "story.a5_kicker": "Act VI",
      "story.a5_headline_html": "Rescued fibre becomes couture — AI-designed, to your measurements.",
      "story.a5_statement": "Made for one. Yours.",
      "story.cta_html": 'Make your first piece <span aria-hidden="true">→</span>',
      "story.skip": "Skip to design",
      "flair.egg": "✦ Revolution unlocked.",
      // Live counter (acts I–IV)
      "story.counter_intro": "Since you arrived:",
      "story.counter_garments": "garments produced",
      "story.counter_trucks": "truckloads of textiles dumped",

      // ── Trust strip ──
      "trust.aria": "Brand highlights",
      "trust.t1_title": "Made to measure",
      "trust.t1_body": "Every piece built to your 9 body measurements — no standard sizes, no compromise",
      "trust.t2_title": "Designed in Zurich",
      "trust.t2_body": "Swiss atelier, transparent production in CHF, fair lead time under 14 days",
      "trust.t3_title": "AI + craft",
      "trust.t3_body": "Generative designs meet real tailors — no print-on-demand, no fast fashion",
      "trust.t4_title": "100% privacy",
      "trust.t4_body": "Measurement detection runs client-side — your photo never leaves your device unless you opt in",

      // ── Workflow ──
      "workflow.s1_html": "<span>1</span> Design",
      "workflow.s2_html": "<span>2</span> Measurements",
      "workflow.s3_html": "<span>3</span> Preview",
      "workflow.s4_html": "<span>4</span> Production",

      // ── Design section ──
      "design.h2": "Describe your design",
      "design.intro": "Tell the AI what you want to wear. Style, color, material, occasion — anything goes.",
      "design.prompt_label": "Your prompt for the AI",
      "design.prompt_placeholder": "e.g.: An oversized streetwear hoodie in heavy organic cotton fleece, in a dark olive tone with graphic embroidery on the chest, wide sleeves, kangaroo pocket and a lined hood...",
      "design.suggestions_inspiration": "Inspiration",
      "design.suggestions_foryou": "For you",
      "design.library_trigger": "My designs",
      "design.garment_label": "Garment type",
      "design.generate_btn": "Generate design",
      "design.generate_loading": "AI generating...",
      "design.output_placeholder": "Your AI-generated design appears here",
      "design.customize_h3": "Customize",
      "design.primary_color": "Primary color",
      "design.material_label": "Material",
      "design.pattern_label": "Pattern",
      "design.fit_label": "Fit",

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

      // ── VTO ──
      "vto.btn": "Generate photorealistic preview",
      "vto.disclaimer": "Sends your photo + the design description to Replicate (FLUX Kontext) for photorealistic generation. External API, ~10 seconds wait.",
      "vto.modal_close": "Close",
      "vto.generating": "Generating photorealistic preview...",
      "vto.result_alt": "Photorealistic preview",
      "vto.download": "Save image",
      "vto.hint_no_photo": 'Upload a photo under "Measurements" first',
      "vto.hint_no_design": "Generate a design first",
      "vto.hint_limit": "Demo limit reached ({limit}/{limit}) — contact us for more",
      "vto.hint_ready_first": "Click generates your photorealistic preview ({limit} per browser)",
      "vto.hint_ready_remaining": "Click generates your photorealistic preview ({remaining} of {limit} left)",
      "vto.status_sending": "Sending request to Replicate...",
      "vto.error_pending": "Generation is taking longer than expected (>20 s) — server limit reached. Please try again or at a different time.",
      "vto.error_unexpected": "Unexpected response from the server.",
      "vto.error_prefix": "Error: {msg}",
      "vto.error_network": "Network error: {msg}",

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

      // ── 3D preview ──
      "preview.h2": "Photorealistic preview",
      "preview.intro": "See your AI design on a real photo of you — photorealistically generated, not a model approximation.",
      "preview.example_tag": "Example",
      "preview.example_label": "This is how your AI design looks photorealistically on you — upload a full-body photo under “Measurements”.",
      "preview.loading_h3": "Loading 3D preview",
      "preview.loading_body": "Three.js is initializing the interactive model with your measurements. If your browser doesn't support WebGL, we'll show a note here.",
      "preview.model_info": "Model info",
      "preview.fabric": "Fabric:",
      "preview.seams": "Seams:",
      "preview.size": "Size:",

      // ── Production ──
      "prod.h2": "Production spec",
      "prod.intro": "All the data the tailor and production need, in a single document.",
      "spec.brief_h4": "Design brief",
      "spec.specs_h4": "Specifications",
      "spec.type": "Garment type",
      "spec.material": "Material",
      "spec.color": "Primary color",
      "spec.fit": "Fit",
      "spec.size": "Size",
      "spec.measures_h4": "Measurements (cm)",
      "spec.notes_h4": "Construction notes for the tailor",
      "spec.id_prefix": "Design ID: {id}",
      "export.h3": "Ready for production?",
      "export.intro": "Download the spec or send it straight to the tailor.",
      "export.json": "Download JSON data",
      "export.html": "Printable spec (HTML)",
      "export.print": "Print directly",
      "export.send": "Send order to production",
      "export.original_prompt": "Original prompt",
      "export.tags": "Tags",
      "export.body_measures": "Body measurements",
      "export.production_data": "Production data",
      "export.est_fabric": "Estimated fabric",
      "export.est_seams": "Estimated seam length",
      "export.duration": "Production time",
      "export.price_range": "Price range",
      "export.footer": "Generated by Urban Revolution AI Atelier",
      "export.order_confirmation": "Order {id} was sent to production",
      "est.time_label": "Estimated production:",
      "est.price_label": "Price range:",
      "est.days": "{n} days",
      "prod.placeholder_desc": "No design generated yet. Describe your desired outfit above.",
      "prod.placeholder_note": "Generate a design first to get construction notes.",
      "prod.placeholder_name": "Untitled Design",

      // ── FAQ ──
      "faq.h2": "FAQ",
      "faq.intro": "Everything you want to know before ordering your first piece.",
      "faq.q1": "How long does production take?",
      "faq.a1": "Usually 7 to 14 working days between order and shipping. More complex pieces (multi-layer jackets, elaborate embroidery) can take up to 21 days — we show you the estimated lead time after generation.",
      "faq.q2": "What happens to my photo?",
      "faq.a2": "For measurement detection everything runs directly in your browser via MediaPipe — the photo never leaves your device and isn't stored. Only if you explicitly request the photorealistic preview is the photo sent once to Replicate (US servers) and immediately discarded after generation.",
      "faq.q3": "What does a made-to-measure piece cost?",
      "faq.a3": "The price depends on fabric type, pattern complexity and chosen measurements. We show you a range in CHF live in the spec-sheet preview — typically CHF 145–220 for T-shirts and shirts, CHF 220–450 for trousers and jackets, CHF 380–680 for coats and dresses.",
      "faq.q4": "What if I haven't been measured?",
      "faq.a4": "Three ways to your measurements — photo analysis (1 click, 100% client-side), manual entry of the 9 values, or a size preset (S/M/L/XL) as a starting point you can adjust afterwards. Tailors receive all values in the production spec.",
      "faq.q5": "Where is it made?",
      "faq.a5": "We currently work with tailoring ateliers in Switzerland and Northern Italy — fairly paid, traceable supply chains, sustainable materials where possible. For every order we see exactly who makes which piece to which spec.",
      "faq.q6": "Can I reorder saved designs later?",
      "faq.a6": "Yes — all designs go to your library (locally in your browser); you can reload, adjust and reorder them anytime. The photorealistic preview is automatically attached to the design on request.",

      // ── Footer ──
      "footer.tagline": "Made-to-measure AI couture from Zurich. AI designs, tailors make, you wear.",
      "footer.aria_atelier": "Atelier",
      "footer.aria_more": "More",
      "footer.col_atelier": "Atelier",
      "footer.design_start": "Start designing",
      "footer.measure": "Body measurements",
      "footer.col_more": "More",
      "footer.code": "Code (open source)",
      "footer.contact": "Contact",
      "footer.imprint": "Imprint",
      "footer.privacy": "Privacy",
      "footer.credits": "Image credits",
      "footer.top": "Back to top",
      "footer.meta_html": '© 2026 Urban Revolution · Designed in Zurich · <a href="impressum.html">Imprint</a> · <a href="datenschutz.html">Privacy</a> · Made with <span aria-label="Love">♥</span> and AI',
      "footer.meta_fine": "Prices in CHF · Production 7–14 days · GDPR-compliant · Photo analysis 100% client-side",

      // ── Design card (dynamic) ──
      "card.eyebrow": "AI DESIGN · {id}",
      "card.fit_suffix": "Fit",
      "card.tailor_notes": "Tailor notes ({n})",
      "card.your_wish": "Your prompt",
      "card.save": "Save",
      "card.saved": "Saved",
      "card.save_aria": "Save design",

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
      "toast.order_sending": "Submitting order...",
      "toast.order_done": "✓ {confirmation}. Delivery approx. {date}",
      "toast.save_failed": "Save failed",
      "toast.saved_lib": '"{name}" saved to your library',
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
  };
})();

window.I18N = I18N;
