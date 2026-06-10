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

      // ── Navigation ──
      "nav.skip": "Zum Inhalt springen",
      "nav.aria": "Hauptnavigation",
      "nav.toggle_open": "Menü öffnen",
      "nav.toggle_close": "Menü schließen",
      "nav.mission": "Problem",
      "nav.design": "Design",
      "nav.measure": "Maße",
      "nav.preview": "Vorschau",
      "nav.production": "Produktion",
      "nav.faq": "FAQ",
      "nav.lang_aria": "Sprache wechseln",
      "nav.create": "UR Create",
      "nav.vision": "Vision",
      "nav.community": "Community",
      "nav.enter": "UR Create starten",

      // ── UR-Create-Direktive (Hero · UR Create · Ownership · Galerie · Problem · Alternative · Vision · Join · Final) ──
      "hero2.eyebrow": "[ URBAN REVOLUTION ]",
      "hero2.headline_html": "Erschaffe die <span class=\"gradient-text\">Zukunft der Mode</span>",
      "hero2.sub": "Entwirf dein eigenes Stück mit UR Create — die Alternative zu Mode von der Stange.",
      "hero2.cta_html": "UR Create starten <span aria-hidden=\"true\">→</span>",
      "hero2.link_html": "Warum das wichtig ist <span aria-hidden=\"true\">↓</span>",
      "hero2.caption": "[ LIVE · KONZEPT ]",
      "urcreate.label": "[ UR CREATE ]",
      "urcreate.h2": "Deine Idee kommt zuerst",
      "urcreate.intro": "Die meiste Mode beginnt in der Fabrik. Deine beginnt hier — mit einer Idee. Entwirf, entwickle weiter, bis es wirklich deins ist.",
      "own.eyebrow": "[ DEIN MOMENT ]",
      "own.headline_html": "Dieses Design existiert, <em>weil du es erschaffen hast.</em>",
      "own.text": "Die meiste Mode entsteht andersherum: Millionen Kleidungsstücke werden produziert, bevor irgendjemand danach gefragt hat. Urban Revolution glaubt, dass Kreativität zuerst kommt.",
      "own.save": "Meine Kreation speichern",
      "own.share": "Teilen",
      "own.publish": "In der Galerie zeigen",
      "own.photoreal_html": "Sieh sie fotorealistisch <span aria-hidden=\"true\">↓</span>",
      "own.why_html": "Entdecke, warum das zählt <span aria-hidden=\"true\">↓</span>",
      "look.label": "[ KONZEPTE ]",
      "look.h2": "Was aus einer Idee entsteht",
      "look.aria": "Lookbook — horizontal scrollen",
      "own.makereal_html": "Mach es real — Maße &amp; Fertigung <span aria-hidden=\"true\">→</span>",
      "own.saved": "Gespeichert in deiner Sammlung.",
      "own.shared": "Link kopiert — teile deine Kreation.",
      "own.published": "In der Community-Galerie veröffentlicht.",
      "gal.label": "[ COMMUNITY ]",
      "gal.h2": "Keine zwei Visionen sind gleich",
      "gal.intro": "Kreationen aus der Community — sieh sie an, lass dich inspirieren oder remixe sie als Start deiner eigenen Evolution.",
      "gal.why_html": "Werde Teil davon <span aria-hidden=\"true\">↓</span>",
      "gal.view": "Ansehen",
      "gal.remix": "Remixen",
      "gal.empty": "Sei die erste Vision. Erschaffe ein Stück und zeig es hier.",
      "gal.anon": "anonym",
      "prob.label": "[ DAS PROBLEM ]",
      "prob.h2": "Die Industrie produziert mehr, als die Welt braucht",
      "prob.c1_k": "01 · Überproduktion",
      "prob.c1_b": "Millionen Kleidungsstücke werden produziert, bevor Nachfrage existiert.",
      "prob.c2_k": "02 · Unverkaufte Ware",
      "prob.c2_b": "Produkte liegen in Lagern und warten auf Käufer, die nie kommen.",
      "prob.c3_k": "03 · Wegwerf-Konsum",
      "prob.c3_b": "Das System belohnt Menge statt Wert.",
      "prob.c4_k": "04 · Abfall",
      "prob.c4_b": "Abfall beginnt, lange bevor ein Kleidungsstück je getragen wird.",
      "prob.next": "Weiter",
      "prob.show_html": "Zeig die Alternative <span aria-hidden=\"true\">→</span>",
      "prob.intro": "Vier Tatsachen — jede mit einer Zahl, die niemand sehen will.",
      "prob.f1_num": "92 Mio. t",
      "prob.f1_ctx": "Kleidung landen jedes Jahr im Müll",
      "prob.f2_num": "1 Lkw / Sekunde",
      "prob.f2_ctx": "Textilien, verbrannt oder vergraben",
      "prob.since": "seit du hier bist",
      "prob.f3_num": "< 1 %",
      "prob.f3_ctx": "der Alttextilien werden zu neuer Kleidung",
      "prob.c5_k": "05 · Der wahre Preis",
      "prob.c5_b": "Hinter billiger Mode steht ein Mensch — nicht nur eine Maschine.",
      "prob.f4_num": "75 h",
      "prob.f4_ctx": "pro Woche, oft unter Existenzlohn (Public Eye)",
      "prob.bridge": "Das ist das System, das wir ersetzen.",
      "alt.label": "[ DIE ALTERNATIVE ]",
      "alt.headline_html": "Mode, die <em>beim Menschen</em> beginnt.",
      "alt.cta_html": "Stell dir ein anderes System vor <span aria-hidden=\"true\">→</span>",
      "vision.label": "[ VISION ]",
      "vision.h2": "Erst der Mensch. Dann das Stück.",
      "vision.s1": "Heute",
      "vision.s2": "Überproduktion",
      "vision.s3": "Kreative Teilhabe",
      "vision.s4": "Bewusste Fertigung",
      "vision.s5": "Die Zukunft",
      "vision.d1": "Mode beginnt heute in der Fabrik: erst die Ware, dann die Suche nach Käufern.",
      "vision.d2": "Das Ergebnis: Berge ungewollter Kleidung, von denen weniger als 1 % je recycelt wird.",
      "vision.d3": "Kehr es um — Menschen erschaffen zuerst. Jede Kreation beginnt mit einer Vorstellung, nicht mit einem Lager.",
      "vision.d4": "Gefertigt wird nur, was wirklich gewollt ist — nach Maß, auf Bestellung, aus geretteter Faser.",
      "vision.d5": "Eine Modewelt ohne Überproduktion: kreativ, bewusst, für genau einen Menschen gemacht.",
      "vision.cta_html": "Werde Teil der Revolution <span aria-hidden=\"true\">→</span>",
      "join.label": "[ COMMUNITY ]",
      "join.h2": "Die Zukunft der Mode entsteht gemeinsam",
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
      "join.already": "Du bist schon dabei — willkommen zurück.",
      "join.err_email": "Bitte gib eine gültige E-Mail-Adresse ein.",
      "join.err_consent": "Bitte bestätige die Einwilligung.",
      "join.err": "Etwas ging schief. Bitte später erneut versuchen.",
      "final.h2_html": "Bereit, die Zukunft der Mode zu erschaffen?",
      "final.sub": "Jede Idee beginnt mit jemandem, der bereit ist, sich etwas anderes vorzustellen.",
      "final.cta_html": "UR Create starten <span aria-hidden=\"true\">→</span>",

      // ── Hero ──
      "hero.eyebrow": "GERETTETE FASER · KI-DESIGN · NACH MASS",
      "hero.title_html": 'Aus Abfall.<br>Nach deinen Maßen.<br><span class="gradient-text">Couture für Einen.</span>',
      "hero.subtitle": "Ein Satz genügt: Die KI entwirft dein Stück, ein Schweizer Schneider näht es aus geretteter Textilfaser — nach deinen Maßen, nur für dich.",
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

      // ── Begin experience (cursor-first opening — no selling, just begin) ──
      "begin.line": "Beschreibe das eine Stück,<br>das du wirklich willst.",
      "begin.hint": "Eins. Für einen. Deins.",
      "begin.scroll": "[ oder scroll, um zu verstehen ↓ ]",

      // ── Geführter Funnel (Hilf-mir-entscheiden) ──
      "funnel.cta": "Weißt du noch nicht genau, was? Lass dich führen",
      "funnel.title": "Lass dich führen",
      "funnel.close": "Schließen",
      "funnel.skip": "[ Ich designe selbst → ]",
      "funnel.q_vibe": "Wofür ist es?",
      "funnel.q_type": "Was für ein Stück?",
      "funnel.q_fit": "Welcher Schnitt?",
      "funnel.q_color": "Welche Farbwelt?",
      "funnel.vibe_everyday": "Alltag",
      "funnel.vibe_street": "Streetwear",
      "funnel.vibe_business": "Business",
      "funnel.vibe_night": "Ausgehen",
      "funnel.vibe_sport": "Sport",
      "funnel.type_tshirt": "T-Shirt",
      "funnel.type_hoodie": "Hoodie",
      "funnel.type_shirt": "Hemd",
      "funnel.type_pants": "Hose",
      "funnel.type_jacket": "Jacke",
      "funnel.type_dress": "Kleid",
      "funnel.fit_slim": "Schmal",
      "funnel.fit_regular": "Regulär",
      "funnel.fit_oversized": "Oversized",
      "funnel.color_black": "Schwarz",
      "funnel.color_white": "Weiß",
      "funnel.color_blue": "Tiefblau",
      "funnel.color_green": "Waldgrün",
      "funnel.color_burgundy": "Burgund",
      "funnel.color_purple": "Violett",

      // ── Manifesto (compact thesis after the hero) ──
      "manifesto.eyebrow": "[ Warum es uns gibt ]",
      "manifesto.headline_html": "Millionen Stücke, die niemand braucht.<br>Wir fertigen <em>eines — deins</em>.",
      "manifesto.problem": "Jede Sekunde wird ein Lastwagen voll Textilien verbrannt oder vergraben. Weniger als 1 % wird je recycelt. Die Faser ist noch gut — das System wirft sie nur weg.",
      "manifesto.stat1_num": "92 Mio. t",
      "manifesto.stat1_label": "Kleidung landen jährlich im Müll",
      "manifesto.stat2_num": "bis 200 Jahre",
      "manifesto.stat2_label": "braucht synthetische Kleidung zum Zerfallen",
      "manifesto.stat3_num": "1 Stück",
      "manifesto.stat3_label": "produzieren wir — für einen Menschen, ohne Überproduktion",
      "manifesto.vision": "Urban Revolution macht aus weggeworfenen Kleidern neuen Stoff. Du beschreibst ein Stück, unsere KI entwirft es, ein Schweizer Schneider näht es nach deinen neun Maßen. Ein Kleidungsstück. Einmal gefertigt. Für dich — aus genau dem, was die Branche wegwirft. Kein neuer Rohstoff, keine Überproduktion, keine Deponie.",
      "manifesto.cta_html": 'Entwirf dein Stück <span aria-hidden="true">→</span>',
      "manifesto.link_html": 'Sieh die Fakten <span aria-hidden="true">↓</span>',

      // ── Section labels (Ovyon-style [ NN / Titel ] kicker) ──
      "sec.design": "[ 03 / Dein Entwurf ]",
      "sec.measure": "[ Deine Maße ]",
      "sec.preview": "[ Fotorealistische Vorschau ]",
      "sec.production": "[ Produktion ]",
      "sec.faq": "[ FAQ ]",

      // ── Facts block (consolidated [ 01 / Das Problem ]) ──
      "facts.eyebrow": "[ Die Belege ]",
      "facts.headline_html": "Die Zahlen <em>dahinter</em>.",
      "facts.r1_k": "Jede Sekunde",
      "facts.r1_fig": "1 Lkw",
      "facts.r1_v": "Textilien — verbrannt oder vergraben",
      "facts.r2_k": "Recycelt",
      "facts.r2_fig": "< 1 %",
      "facts.r2_v": "zurück in neue Kleidung",
      "facts.r3_k": "Kleidung im Müll",
      "facts.r3_fig": "92 Mio. t",
      "facts.r3_v": "jedes Jahr, weltweit",
      "facts.r4_k": "CO₂ der Mode",
      "facts.r4_fig": "bis 8 %",
      "facts.r4_v": "global — mehr als Flüge und Schifffahrt zusammen",
      "facts.r5_k": "Der Mensch",
      "facts.r5_fig": "75 h",
      "facts.r5_v": "Wochen, unter Existenzlohn (Public Eye)",
      "facts.model_k": "[ Unser Modell ]",
      "facts.model_v": "1 Stück · nach Maß · aus Stoff aus recycelten Kleidern · 0 Überproduktion",
      "facts.chart_cap": "[ Carbon-Intensität pro Umsatz — die Treiber ]",
      "facts.sources_html": '[ Quellen ] <a href="https://www.ellenmacarthurfoundation.org/a-new-textiles-economy" target="_blank" rel="noopener">Ellen MacArthur Foundation</a> · <a href="https://www.unep.org/news-and-stories/story/environmental-costs-fast-fashion" target="_blank" rel="noopener">UNEP</a> · <a href="https://www.publiceye.ch/en" target="_blank" rel="noopener">Public Eye</a> · Commons',

      // ── Live-Abfall-Zähler (Ticker, C+A) ──
      "ticker.unit": "kg",
      "ticker.live": "Live",
      "ticker.live_rate": "Live · jede Sekunde +2'918 kg",
      "ticker.cap_full": "Textilien verbrannt oder vergraben, seit du hier bist.",
      "ticker.cap_short": "verbrannt oder vergraben · seit du hier bist",
      "ticker.source": "[ Quelle: UNEP · 92 Mio. t / Jahr ]",

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

      // ── The true cost (fast-fashion evidence band) ──
      "cost.kicker": "Der wahre Preis",
      "cost.headline_html": "Irgendwo zahlt jemand den Preis für „billig“.",
      "cost.lead": "Hinter jeder 5-Franken-Bluse steht ein Mensch. Recherchen der Schweizer NGO Public Eye zeigen: In Zulieferfabriken von Shein nähen Arbeiter:innen bis zu 75 Stunden pro Woche — für Löhne unter dem Existenzminimum.",
      "cost.s1_num": "bis 8 %",
      "cost.s1_label": "der globalen CO₂-Emissionen stammen aus der Mode — mehr als internationale Flüge und Schifffahrt zusammen.",
      "cost.s2_num": "1 / Sekunde",
      "cost.s2_label": "Jede Sekunde wird ein Lastwagen voll Textilien verbrannt oder deponiert.",
      "cost.s3_num": "unter 1 %",
      "cost.s3_label": "der Altkleider wird zu neuer Kleidung recycelt. Der Rest wird zu Abfall.",
      "cost.chart_cap": "Wer treibt die Krise? Carbon-Intensität pro Umsatz — die Fast-Fashion-Riesen im Vergleich.",
      "cost.chart_note": "Relative Carbon-Intensität pro Mrd. $ Umsatz (Rangfolge, illustrativ). Quelle: Commons.",
      "cost.close": "Das ist das System, das wir ersetzen.",
      "cost.sources_html": 'Quellen: <a href="https://www.ellenmacarthurfoundation.org/a-new-textiles-economy" target="_blank" rel="noopener">Ellen MacArthur Foundation</a> · <a href="https://www.unep.org/news-and-stories/story/environmental-costs-fast-fashion" target="_blank" rel="noopener">UNEP</a> · <a href="https://www.publiceye.ch/en" target="_blank" rel="noopener">Public Eye</a>',

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

      // ── How it works (3-step) ──
      "howto.eyebrow": "[ 02 / Das Modell ]",
      "howto.heading": "Vom Wunsch zum Einzelstück — in drei Schritten.",
      "howto.s1_title": "Finde heraus, was du suchst",
      "howto.s1_body": "Klick dich durch ein paar Fragen — Stimmung, Form, Stoff. Aus deinen Entscheidungen wächst live ein konkretes Stück. Lieber direkt? Beschreib es in einem Satz.",
      "howto.s2_title": "Deine Maße, dein Schnitt",
      "howto.s2_body": "Neun Körpermaße — per Foto geschätzt oder manuell. Keine Standardgröße, kein Kompromiss: gefertigt für genau einen Körper, deinen.",
      "howto.s3_title": "Aus geretteter Faser genäht",
      "howto.s3_body": "Ein Schweizer Schneider näht dein Stück aus geretteter Faser recycelter Alttextilien — auf Bestellung, in rund 14 Tagen bei dir. Kein Lager, keine Überproduktion.",
      "howto.ai_note": "<strong>Und die KI?</strong> Sie steht nicht im Rampenlicht — sie arbeitet im Hintergrund: übersetzt deine Entscheidungen in einen präzisen, produzierbaren Schnitt und denkt bei Passform und Material mit. KI als Werkzeug, das ein echtes Problem löst — Größen, die niemandem passen, und Berge, die niemand braucht — nicht als Selbstzweck.",
      "howto.p1": "Aus geretteter Faser",
      "howto.p2": "Maßanfertigung",
      "howto.p3": "Null Überproduktion",

      // ── Workflow ──
      "workflow.s1_html": "<span>1</span> Design",
      "workflow.s2_html": "<span>2</span> Maße",
      "workflow.s3_html": "<span>3</span> Vorschau",
      "workflow.s4_html": "<span>4</span> Produktion",

      // ── Design-Sektion ──
      "design.h2": "Triff ein paar Entscheidungen",
      "design.intro": "Kein Formular. Du wählst, vergleichst, schiebst — wir lesen dein Stück aus deinen Entscheidungen ab. Worte nicht nötig.",
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
      "design.length_label": "Länge",
      "design.print_label": "Aufschrift",
      "design.print_placeholder": "z. B. dein Name, ein Wort …",
      "design.print_hint": "Erscheint vorne auf dem Stück · max. 24 Zeichen",

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

      // ── Design Engine (Reise) ──
      "engine.back": "Zurück",
      "engine.skip": "Überspringen",
      "engine.finish_early": "Fertig",
      "engine.maturity_aria": "Design-Reife",
      "engine.confirm": "Weiter",
      "engine.scheme_mono": "Uni",
      "engine.scheme_duo": "Verlauf",
      "engine.done_title": "Dein Design",
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
      "engine.intro_sub": "Keine Beschreibung nötig — wähle, vergleiche, fühle. Dein Stück entsteht aus deinen Entscheidungen. Den letzten Schliff gibst du am Ende mit einem Satz, und die KI macht dein Einzelstück daraus.",
      "engine.intro_start": "Reise beginnen",
      "engine.refine_freetext_label": "Etwas, das wir nicht erraten konnten? Ergänze es in einem Satz.",
      "engine.refine_freetext_ph": "z.B. verdeckte Knopfleiste, Innentasche fürs Handy …",

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

      // ── Generische, neutrale Service-Fehler (Edge-Function-Codes) ──
      "err.service_unavailable": "Der Bild-Dienst ist gerade nicht verfügbar. Bitte versuch es später erneut.",
      "err.rate_limited": "Gerade sind viele Anfragen unterwegs — bitte in einer Minute erneut versuchen.",
      "err.failed": "Die Generierung ist fehlgeschlagen. Bitte versuch es erneut.",

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
      "preview.model_info": "Stück-Info",
      "preview.fabric": "Stoffmenge:",
      "preview.seams": "Nähte:",
      "preview.size": "Größe:",

      // ── Entwurfs-Vorschau (KI-Studio-Render im Design-Schritt) ──
      "dpreview.btn": "Entwurf visualisieren",
      "dpreview.loading": "KI rendert deinen Entwurf …",
      "dpreview.badge": "KI-RENDER",
      "dpreview.caption": "Studio-Visualisierung deines Entwurfs — die finale Maßanfertigung kann abweichen.",
      "dpreview.img_alt": "KI-Studio-Render des Entwurfs",
      "dpreview.regenerate": "Neu rendern",
      "dpreview.hint_first": "Zeigt dein Design als Studio-Render — ohne Foto, {limit} pro Browser. Das Try-on mit deinem Foto kommt in Schritt 3.",
      "dpreview.hint_remaining": "Noch {remaining} von {limit} Renders übrig.",
      "dpreview.hint_limit": "Render-Limit erreicht ({limit}/{limit}).",
      "dpreview.retry": "Erneut versuchen",
      "dpreview.error_prefix": "Fehler: {msg}",
      "dpreview.error_pending": "Render dauert länger als erwartet (>20 s). Bitte erneut versuchen.",
      "dpreview.error_unexpected": "Unerwartete Antwort vom Server.",
      "dpreview.error_network": "Netzwerkfehler: {msg}",
      "dpreview.fallback_badge": "STILVORSCHAU",
      "dpreview.genesis_badge": "ES ENTSTEHT …",
      "dpreview.fallback_caption": "Kostenlose Stilvorschau aus deinem Entwurf — der fotorealistische Render ist gerade nicht verfügbar.",
      "dpreview.fallback_retry": "Fotorealistisch versuchen",

      // ── Produktion ──
      "prod.h2": "Produktions-Vorlage",
      "prod.intro": "Alle Daten, die der Schneider und die Produktion benötigen, in einem Dokument.",
      "spec.brief_h4": "Design Brief",
      "spec.specs_h4": "Spezifikationen",
      "spec.type": "Kleidungstyp",
      "spec.material": "Material",
      "spec.color": "Primärfarbe",
      "spec.fit": "Passform",
      "spec.length": "Länge",
      "spec.print": "Aufschrift",
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
      "head.title": "Urban Revolution — Create the future of fashion",

      // ── Navigation ──
      "nav.skip": "Skip to content",
      "nav.aria": "Main navigation",
      "nav.toggle_open": "Open menu",
      "nav.toggle_close": "Close menu",
      "nav.mission": "Problem",
      "nav.design": "Design",
      "nav.measure": "Measurements",
      "nav.preview": "Preview",
      "nav.production": "Production",
      "nav.faq": "FAQ",
      "nav.lang_aria": "Switch language",
      "nav.create": "UR Create",
      "nav.vision": "Vision",
      "nav.community": "Community",
      "nav.enter": "Enter UR Create",

      // ── UR Create directive (Hero · UR Create · Ownership · Gallery · Problem · Alternative · Vision · Join · Final) ──
      "hero2.eyebrow": "[ URBAN REVOLUTION ]",
      "hero2.headline_html": "Create the <span class=\"gradient-text\">future of fashion</span>",
      "hero2.sub": "Explore unique fashion concepts through UR Create — and discover a new alternative to mass-produced fashion.",
      "hero2.cta_html": "Enter UR Create <span aria-hidden=\"true\">→</span>",
      "hero2.link_html": "Discover why it matters <span aria-hidden=\"true\">↓</span>",
      "hero2.caption": "[ LIVE · CONCEPT ]",
      "urcreate.label": "[ UR CREATE ]",
      "urcreate.h2": "Your imagination comes first",
      "urcreate.intro": "Most fashion starts with production. What happens when it starts with people? Create, evolve, make it yours.",
      "own.eyebrow": "[ YOUR MOMENT ]",
      "own.headline_html": "This design exists <em>because you created it.</em>",
      "own.text": "Most fashion is created the other way around: millions of garments are produced before anyone asks for them. Urban Revolution believes creativity should come first.",
      "own.save": "Save my creation",
      "own.share": "Share",
      "own.publish": "Show in the gallery",
      "own.photoreal_html": "See it photoreal <span aria-hidden=\"true\">↓</span>",
      "own.why_html": "Discover why this matters <span aria-hidden=\"true\">↓</span>",
      "look.label": "[ CONCEPTS ]",
      "look.h2": "What emerges when people come first",
      "look.aria": "Lookbook — scroll horizontally",
      "own.makereal_html": "Make it real — measurements &amp; production <span aria-hidden=\"true\">→</span>",
      "own.saved": "Saved to your collection.",
      "own.shared": "Link copied — share your creation.",
      "own.published": "Published to the community gallery.",
      "gal.label": "[ COMMUNITY ]",
      "gal.h2": "No two visions are the same",
      "gal.intro": "Creations from the community — view them, save them for inspiration, or remix one as the start of your own evolution.",
      "gal.why_html": "Become part of it <span aria-hidden=\"true\">↓</span>",
      "gal.view": "View",
      "gal.remix": "Remix",
      "gal.empty": "Be the first vision. Create a piece and show it here.",
      "gal.anon": "anonymous",
      "prob.label": "[ THE PROBLEM ]",
      "prob.h2": "The industry creates more than the world needs",
      "prob.c1_k": "01 · Overproduction",
      "prob.c1_b": "Millions of garments are produced before demand exists.",
      "prob.c2_k": "02 · Unsold inventory",
      "prob.c2_b": "Products sit in warehouses waiting for buyers who never come.",
      "prob.c3_k": "03 · Disposable consumption",
      "prob.c3_b": "The system rewards volume over value.",
      "prob.c4_k": "04 · Waste",
      "prob.c4_b": "Waste begins long before a garment is ever worn.",
      "prob.next": "Next",
      "prob.show_html": "Show the alternative <span aria-hidden=\"true\">→</span>",
      "prob.intro": "Four facts — each with a number no one wants to see.",
      "prob.f1_num": "92M tonnes",
      "prob.f1_ctx": "of clothing are trashed every year",
      "prob.f2_num": "1 truck / second",
      "prob.f2_ctx": "of textiles, burned or buried",
      "prob.since": "since you arrived",
      "prob.f3_num": "< 1 %",
      "prob.f3_ctx": "of used textiles become new clothing",
      "prob.c5_k": "05 · The true cost",
      "prob.c5_b": "Behind cheap fashion stands a person — not just a machine.",
      "prob.f4_num": "75 h",
      "prob.f4_ctx": "a week, often below a living wage (Public Eye)",
      "prob.bridge": "This is the system we replace.",
      "alt.label": "[ THE ALTERNATIVE ]",
      "alt.headline_html": "What if fashion started <em>with people?</em>",
      "alt.cta_html": "Imagine a different system <span aria-hidden=\"true\">→</span>",
      "vision.label": "[ VISION ]",
      "vision.h2": "Fashion should start with people",
      "vision.s1": "Today",
      "vision.s2": "Overproduction",
      "vision.s3": "Creative participation",
      "vision.s4": "Intentional creation",
      "vision.s5": "The future",
      "vision.d1": "Fashion today starts in the factory: goods first, then the search for buyers.",
      "vision.d2": "The result: mountains of unwanted clothing, less than 1% of it ever recycled.",
      "vision.d3": "Flip it — people create first. Every creation begins with imagination, not a warehouse.",
      "vision.d4": "Only what's truly wanted gets made — to measure, on demand, from rescued fibre.",
      "vision.d5": "A fashion world without overproduction: creative, intentional, made for exactly one person.",
      "vision.cta_html": "Join the revolution <span aria-hidden=\"true\">→</span>",
      "join.label": "[ COMMUNITY ]",
      "join.h2": "The future of fashion is built together",
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
      "join.already": "You're already in — welcome back.",
      "join.err_email": "Please enter a valid email address.",
      "join.err_consent": "Please confirm consent.",
      "join.err": "Something went wrong. Please try again later.",
      "final.h2_html": "Ready to create the future of fashion?",
      "final.sub": "Every idea begins with someone willing to imagine something different.",
      "final.cta_html": "Enter UR Create <span aria-hidden=\"true\">→</span>",

      // ── Hero ──
      "hero.eyebrow": "RESCUED FIBRE · AI DESIGN · MADE TO MEASURE",
      "hero.title_html": 'From waste.<br>To your measure.<br><span class="gradient-text">Couture for one.</span>',
      "hero.subtitle": "One sentence is enough: the AI designs your piece, a Swiss tailor sews it from rescued textile fibre — to your measurements, for you alone.",
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

      // ── Begin experience (cursor-first opening — no selling, just begin) ──
      "begin.line": "Describe the one piece<br>you actually want.",
      "begin.hint": "One. For one. Yours.",
      "begin.scroll": "[ or scroll to understand ↓ ]",

      // ── Guided funnel (help-me-decide) ──
      "funnel.cta": "Not sure what you want yet? Let us guide you",
      "funnel.title": "Let us guide you",
      "funnel.close": "Close",
      "funnel.skip": "[ I'll design myself → ]",
      "funnel.q_vibe": "What's it for?",
      "funnel.q_type": "What kind of piece?",
      "funnel.q_fit": "Which fit?",
      "funnel.q_color": "Which colour?",
      "funnel.vibe_everyday": "Everyday",
      "funnel.vibe_street": "Streetwear",
      "funnel.vibe_business": "Business",
      "funnel.vibe_night": "Going out",
      "funnel.vibe_sport": "Sport",
      "funnel.type_tshirt": "T-Shirt",
      "funnel.type_hoodie": "Hoodie",
      "funnel.type_shirt": "Shirt",
      "funnel.type_pants": "Pants",
      "funnel.type_jacket": "Jacket",
      "funnel.type_dress": "Dress",
      "funnel.fit_slim": "Slim",
      "funnel.fit_regular": "Regular",
      "funnel.fit_oversized": "Oversized",
      "funnel.color_black": "Black",
      "funnel.color_white": "White",
      "funnel.color_blue": "Deep blue",
      "funnel.color_green": "Forest green",
      "funnel.color_burgundy": "Burgundy",
      "funnel.color_purple": "Purple",

      // ── Manifesto (compact thesis after the hero) ──
      "manifesto.eyebrow": "[ Why we exist ]",
      "manifesto.headline_html": "Millions of pieces no one needs.<br>We make <em>one — yours</em>.",
      "manifesto.problem": "Every second, a truckload of textiles is burned or buried. Less than 1% is ever recycled. The fibre is still good — the system just throws it away.",
      "manifesto.stat1_num": "92M tonnes",
      "manifesto.stat1_label": "of clothing wasted every year",
      "manifesto.stat2_num": "up to 200 years",
      "manifesto.stat2_label": "for synthetic clothing to break down",
      "manifesto.stat3_num": "1 piece",
      "manifesto.stat3_label": "is all we make — for one person, no overproduction",
      "manifesto.vision": "Urban Revolution turns discarded clothes into new fabric. You describe a piece, our AI designs it, a Swiss tailor cuts it to your nine measurements. One garment, made once, for you — from exactly what the industry throws away. No virgin material, no overproduction, no landfill.",
      "manifesto.cta_html": 'Design your piece <span aria-hidden="true">→</span>',
      "manifesto.link_html": 'See the facts <span aria-hidden="true">↓</span>',

      // ── Section labels (Ovyon-style [ NN / Title ] kicker) ──
      "sec.design": "[ 03 / Your Design ]",
      "sec.measure": "[ Your measurements ]",
      "sec.preview": "[ Photoreal preview ]",
      "sec.production": "[ Production ]",
      "sec.faq": "[ FAQ ]",

      // ── Facts block (consolidated [ 01 / The Problem ]) ──
      "facts.eyebrow": "[ The evidence ]",
      "facts.headline_html": "The numbers <em>behind it</em>.",
      "facts.r1_k": "Every second",
      "facts.r1_fig": "1 truck",
      "facts.r1_v": "of textiles — burned or buried",
      "facts.r2_k": "Recycled",
      "facts.r2_fig": "< 1 %",
      "facts.r2_v": "back into new clothing",
      "facts.r3_k": "Clothing trashed",
      "facts.r3_fig": "92 M t",
      "facts.r3_v": "every year, worldwide",
      "facts.r4_k": "Fashion's CO₂",
      "facts.r4_fig": "up to 8 %",
      "facts.r4_v": "globally — more than flights and shipping",
      "facts.r5_k": "The human cost",
      "facts.r5_fig": "75 h",
      "facts.r5_v": "weeks, below a living wage (Public Eye)",
      "facts.model_k": "[ Our model ]",
      "facts.model_v": "1 piece · made to measure · from fabric made of old clothes · 0 overproduction",
      "facts.chart_cap": "[ Carbon intensity per revenue — the drivers ]",
      "facts.sources_html": '[ Sources ] <a href="https://www.ellenmacarthurfoundation.org/a-new-textiles-economy" target="_blank" rel="noopener">Ellen MacArthur Foundation</a> · <a href="https://www.unep.org/news-and-stories/story/environmental-costs-fast-fashion" target="_blank" rel="noopener">UNEP</a> · <a href="https://www.publiceye.ch/en" target="_blank" rel="noopener">Public Eye</a> · Commons',

      // ── Live waste counter (ticker, C+A) ──
      "ticker.unit": "kg",
      "ticker.live": "Live",
      "ticker.live_rate": "Live · every second +2'918 kg",
      "ticker.cap_full": "of textiles burned or buried, since you arrived.",
      "ticker.cap_short": "burned or buried · since you arrived",
      "ticker.source": "[ Source: UNEP · 92 M t / year ]",

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

      // ── The true cost (fast-fashion evidence band) ──
      "cost.kicker": "The true cost",
      "cost.headline_html": "Somewhere, someone pays the price for “cheap.”",
      "cost.lead": "Behind every five-franc blouse is a person. Investigations by the Swiss NGO Public Eye found workers in Shein’s supplier factories sewing up to 75 hours a week — for wages below a living wage.",
      "cost.s1_num": "up to 8%",
      "cost.s1_label": "of global CO₂ emissions come from fashion — more than international flights and shipping combined.",
      "cost.s2_num": "1 / second",
      "cost.s2_label": "Every second, a truckload of textiles is burned or sent to landfill.",
      "cost.s3_num": "under 1%",
      "cost.s3_label": "of used clothing is recycled into new clothing. The rest becomes waste.",
      "cost.chart_cap": "Who drives the crisis? Carbon intensity per revenue — the fast-fashion giants compared.",
      "cost.chart_note": "Relative carbon intensity per $bn revenue (ranking, illustrative). Source: Commons.",
      "cost.close": "This is the system we replace.",
      "cost.sources_html": 'Sources: <a href="https://www.ellenmacarthurfoundation.org/a-new-textiles-economy" target="_blank" rel="noopener">Ellen MacArthur Foundation</a> · <a href="https://www.unep.org/news-and-stories/story/environmental-costs-fast-fashion" target="_blank" rel="noopener">UNEP</a> · <a href="https://www.publiceye.ch/en" target="_blank" rel="noopener">Public Eye</a>',

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

      // ── How it works (3-step) ──
      "howto.eyebrow": "[ 02 / The Model ]",
      "howto.heading": "From your idea to a one-of-one — in three steps.",
      "howto.s1_title": "Find out what you're looking for",
      "howto.s1_body": "Click through a few questions — mood, shape, fabric. Your choices grow into a real piece, live. Prefer it direct? Describe it in one sentence.",
      "howto.s2_title": "Your measurements, your cut",
      "howto.s2_body": "Nine body measurements — estimated from a photo or entered by hand. No standard size, no compromise: cut for exactly one body, yours.",
      "howto.s3_title": "Sewn from rescued fibre",
      "howto.s3_body": "A Swiss tailor sews your piece from fibre rescued from recycled textiles — on demand, at your door in about 14 days. No warehouse, no overproduction.",
      "howto.ai_note": "<strong>And the AI?</strong> It's not the star — it works in the background: turning your choices into a precise, producible cut and thinking along on fit and fabric. AI as a tool that solves a real problem — sizes that fit no one, and mountains nobody needs — not as an end in itself.",
      "howto.p1": "From rescued fibre",
      "howto.p2": "Made to measure",
      "howto.p3": "Zero overproduction",

      // ── Workflow ──
      "workflow.s1_html": "<span>1</span> Design",
      "workflow.s2_html": "<span>2</span> Measurements",
      "workflow.s3_html": "<span>3</span> Preview",
      "workflow.s4_html": "<span>4</span> Production",

      // ── Design section ──
      "design.h2": "Make a few choices",
      "design.intro": "No form. You choose, compare, nudge — we read your piece from your decisions. No words needed.",
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
      "design.length_label": "Length",
      "design.print_label": "Print",
      "design.print_placeholder": "e.g. your name, a word …",
      "design.print_hint": "Appears on the front of the piece · max. 24 characters",

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

      // ── Design Engine (journey) ──
      "engine.back": "Back",
      "engine.skip": "Skip",
      "engine.finish_early": "Done",
      "engine.maturity_aria": "Design readiness",
      "engine.confirm": "Next",
      "engine.scheme_mono": "Solid",
      "engine.scheme_duo": "Gradient",
      "engine.done_title": "Your design",
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
      "engine.intro_sub": "No description needed — choose, compare, feel. Your piece takes shape from your decisions. At the very end, one sentence adds the final touch, and the AI turns it into your one-of-one.",
      "engine.intro_start": "Begin",
      "engine.refine_freetext_label": "Anything we couldn't read from your choices? Add it in one sentence.",
      "engine.refine_freetext_ph": "e.g. hidden placket, inside pocket for a phone …",

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

      // ── Photorealistic preview ──
      "preview.h2": "Photorealistic preview",
      "preview.intro": "See your AI design on a real photo of you — photorealistically generated, not a model approximation.",
      "preview.example_tag": "Example",
      "preview.example_label": "This is how your AI design looks photorealistically on you — upload a full-body photo under “Measurements”.",
      "preview.model_info": "Garment info",
      "preview.fabric": "Fabric:",
      "preview.seams": "Seams:",
      "preview.size": "Size:",

      // ── Design preview (AI studio render in the design step) ──
      "dpreview.btn": "Visualise the design",
      "dpreview.loading": "AI is rendering your design …",
      "dpreview.badge": "AI RENDER",
      "dpreview.caption": "Studio visualisation of your concept — the final tailored piece may differ.",
      "dpreview.img_alt": "AI studio render of the design",
      "dpreview.regenerate": "Re-render",
      "dpreview.hint_first": "Shows your design as a studio render — no photo needed, {limit} per browser. The try-on with your photo comes in step 3.",
      "dpreview.hint_remaining": "{remaining} of {limit} renders left.",
      "dpreview.hint_limit": "Render limit reached ({limit}/{limit}).",
      "dpreview.retry": "Try again",
      "dpreview.error_prefix": "Error: {msg}",
      "dpreview.error_pending": "Render is taking longer than expected (>20 s). Please try again.",
      "dpreview.error_unexpected": "Unexpected response from the server.",
      "dpreview.error_network": "Network error: {msg}",
      "dpreview.fallback_badge": "STYLE PREVIEW",
      "dpreview.genesis_badge": "TAKING SHAPE …",
      "dpreview.fallback_caption": "Free style preview from your design — the photoreal render is unavailable right now.",
      "dpreview.fallback_retry": "Try photoreal render",

      // ── Production ──
      "prod.h2": "Production spec",
      "prod.intro": "All the data the tailor and production need, in a single document.",
      "spec.brief_h4": "Design brief",
      "spec.specs_h4": "Specifications",
      "spec.type": "Garment type",
      "spec.material": "Material",
      "spec.color": "Primary color",
      "spec.fit": "Fit",
      "spec.length": "Length",
      "spec.print": "Print",
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
    // Exposed for the DE/EN key-parity test (read-only data); harmless in the
    // browser. Lets tooling diff the two language tables without re-parsing.
    dict,
  };
})();

if (typeof window !== "undefined") window.I18N = I18N;
if (typeof module !== "undefined" && module.exports) module.exports = I18N;
