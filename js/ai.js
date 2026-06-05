/**
 * Urban Revolution — AI Design Generator (REFACTORED)
 * Improved error handling and validation
 */

const AI = (() => {
  const t = (key, vars) => (window.I18N ? window.I18N.t(key, vars) : key);

  // Use centralized config
  const COLOR_DICT = Object.entries(CONFIG.COLORS).reduce((acc, [name, hex]) => {
    acc[name.toLowerCase()] = hex;
    acc[name.replace("_", "").toLowerCase()] = hex;
    return acc;
  }, {});

  const GERMAN_COLOR_ALIASES = {
    schwarz: "black",
    weiss: "white", "weiß": "white",
    rot: "red",
    blau: "blue",
    gruen: "green", "grün": "green",
    braun: "brown",
    gold: "gold", golden: "gold",
    bordeaux: "burgundy", weinrot: "burgundy",
    lila: "purple", violett: "purple",
    bernstein: "amber",
  };
  for (const [german, english] of Object.entries(GERMAN_COLOR_ALIASES)) {
    if (CONFIG.COLORS[english]) COLOR_DICT[german] = CONFIG.COLORS[english];
  }

  const MATERIAL_DICT = {
    baumwolle: "cotton",
    cotton: "cotton",
    pima: "cotton",
    jersey: "cotton",
    leinen: "linen",
    linen: "linen",
    leinenmix: "linen",
    denim: "denim",
    jeans: "denim",
    selvedge: "denim",
    wolle: "wool",
    wool: "wool",
    kaschmir: "wool",
    merino: "wool",
    tweed: "wool",
    fleece: "fleece",
    sweat: "fleece",
    frottee: "fleece",
    seide: "silk",
    silk: "silk",
    satin: "silk",
    viskose: "silk",
    polyester: "polyester",
    recycelt: "polyester",
    recycled: "polyester",
    nylon: "polyester",
    techwear: "polyester",
  };

  const TYPE_DICT = {
    hoodie: "hoodie",
    kapuze: "hoodie",
    sweater: "hoodie",
    sweatshirt: "hoodie",
    hemd: "shirt",
    shirt: "shirt",
    oxford: "shirt",
    bluse: "shirt",
    polo: "shirt",
    "t-shirt": "tshirt",
    tshirt: "tshirt",
    tee: "tshirt",
    shirt_short: "tshirt",
    hose: "pants",
    jeans: "pants",
    pants: "pants",
    chino: "pants",
    cargo: "pants",
    trouser: "pants",
    jacke: "jacket",
    jacket: "jacket",
    blazer: "jacket",
    mantel: "jacket",
    parka: "jacket",
    bomber: "jacket",
    kleid: "dress",
    dress: "dress",
    robe: "dress",
  };

  const FIT_DICT = {
    skinny: 0.05,
    ultraslim: 0.05,
    slim: 0.18,
    tailliert: 0.22,
    schmal: 0.18,
    eng: 0.12,
    fitted: 0.2,
    regular: 0.5,
    klassisch: 0.5,
    standard: 0.5,
    relaxed: 0.65,
    loose: 0.75,
    weit: 0.78,
    locker: 0.7,
    oversized: 0.93,
    übergross: 0.93,
    uebergross: 0.93,
    baggy: 0.92,
  };

  const PATTERN_KEYWORDS = {
    gestreift: "stripes_h",
    streifen: "stripes_h",
    striped: "stripes_h",
    längssteifen: "stripes_v",
    laengsstreifen: "stripes_v",
    vertical: "stripes_v",
    gepunktet: "dots",
    punkte: "dots",
    polka: "dots",
    dots: "dots",
    kariert: "plaid",
    karo: "plaid",
    plaid: "plaid",
    check: "plaid",
    camo: "camo",
    tarnmuster: "camo",
    camouflage: "camo",
    gradient: "gradient",
    verlauf: "gradient",
    ombre: "gradient",
    floral: "floral",
    blumen: "floral",
    blümchen: "floral",
    meliert: "heather",
    heather: "heather",
  };

  function extractFromPrompt(prompt, dict) {
    const lower = prompt.toLowerCase();
    let bestMatch = null;
    let bestLength = 0;
    for (const [keyword, value] of Object.entries(dict)) {
      if (lower.includes(keyword) && keyword.length > bestLength) {
        bestMatch = value;
        bestLength = keyword.length;
      }
    }
    return bestMatch;
  }

  function detectColor(prompt) {
    return extractFromPrompt(prompt, COLOR_DICT) || "#1a1a1a";
  }

  function detectMaterial(prompt) {
    return extractFromPrompt(prompt, MATERIAL_DICT) || "cotton";
  }

  function detectType(prompt) {
    return extractFromPrompt(prompt, TYPE_DICT);
  }

  function detectFit(prompt) {
    const fit = extractFromPrompt(prompt, FIT_DICT);
    return fit !== null ? fit : 0.5;
  }

  function detectPattern(prompt) {
    return extractFromPrompt(prompt, PATTERN_KEYWORDS) || "solid";
  }

  function detectSecondaryColor(prompt, primaryColor) {
    const phrases = [
      /mit\s+(\w+en)\s+(streifen|akzenten|stickerei|details|kontrast)/i,
      /(\w+)\s+(streifen|akzent|kontrast)/i,
      /und\s+(\w+)/i,
    ];
    for (const re of phrases) {
      const match = prompt.match(re);
      if (match) {
        for (const word of match.slice(1)) {
          const norm = word.toLowerCase().replace(/(en|er|es|e)$/, "");
          for (const [key, val] of Object.entries(COLOR_DICT)) {
            if (norm.includes(key) || key.includes(norm)) {
              if (val !== primaryColor) return val;
            }
          }
        }
      }
    }
    return primaryColor === "#ffffff" ? "#1a1a1a" : "#ffffff";
  }

  function generateName(type) {
    const adjectives = {
      tshirt: ["Essential", "Signature", "Classic", "Urban", "Studio"],
      hoodie: ["Atelier", "Heritage", "Urban", "Street", "Cult"],
      shirt: ["Manhattan", "Riviera", "Atelier", "Heritage", "Sartorial"],
      pants: ["Modular", "Tokyo", "Heritage", "Workwear", "Studio"],
      jacket: ["Bauhaus", "Brutalist", "Atelier", "Heritage", "Modular"],
      dress: ["Soirée", "Atelier", "Riviera", "Modern", "Sculptural"],
    };
    const adj = adjectives[type] || adjectives.tshirt;
    const chosen = adj[Math.floor(Math.random() * adj.length)];
    const typeName = t("ainame." + type);
    return `${chosen} ${typeName === "ainame." + type ? t("ainame.fallback") : typeName}`;
  }

  function generateConstructionNotes(type) {
    const notes = t("notes." + type);
    return Array.isArray(notes) ? notes : t("notes.tshirt");
  }

  /**
   * Preferred path: ask the server-side Vercel Edge Function
   * (api/generate-design.js) which holds ANTHROPIC_API_KEY securely.
   * Returns the design JSON, or null so the caller falls through to the
   * browser-key path and then the local generator. Stays silent when the
   * endpoint is simply absent (static host) or the key isn't configured;
   * surfaces real failures via the ai-fallback event so app.js can toast.
   */
  async function generateWithServer(prompt, type) {
    let response;
    try {
      response = await fetch("/api/generate-design", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, type }),
      });
    } catch {
      return null; // endpoint unreachable (static host / offline)
    }

    if (response.status === 404) return null; // no edge function on this host

    let body;
    try {
      body = await response.json();
    } catch {
      body = {};
    }

    if (response.ok && body && body.name) {
      return body;
    }

    const reason = body && body.error ? body.error : `HTTP ${response.status}`;
    // "not configured" is an expected, quiet fallback (no key on server).
    if (!/not configured/i.test(reason)) {
      // Report the real upstream failure (Replicate/Anthropic proxy) to Sentry —
      // only the coded reason + HTTP status, never the prompt (no PII).
      if (window.Sentry) {
        window.Sentry.captureException(new Error("AI proxy failed: " + reason), {
          tags: { area: "ai", status: response.status },
        });
      }
      window.dispatchEvent(new CustomEvent("ai-fallback", { detail: { reason } }));
    }
    return null;
  }

  async function generateWithClaude(prompt, type) {
    const apiKey = window.URBAN_REVOLUTION_API_KEY;
    if (!apiKey) return null;

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1024,
          messages: [
            {
              role: "user",
              content: `Du bist Designer für Urban Revolution. Erstelle ein JSON-Design-Konzept für: "${prompt}". Kleidungstyp: ${type}.

Antworte NUR mit JSON:
{
  "name": "Designname (max 4 Wörter)",
  "description": "2-3 Sätze, ${window.I18N && window.I18N.getLang() === "en" ? "Englisch" : "Deutsch"}",
  "color": "#hexcode",
  "material": "cotton|linen|denim|wool|fleece|silk|polyester",
  "fit": 0.0 bis 1.0,
  "tags": ["tag1","tag2","tag3"],
  "constructionNotes": ["Note 1","Note 2","Note 3"]
}`,
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg =
          errorData.error?.message || `API error: ${response.status}`;
        throw new Error(`Claude API failed: ${errorMsg}`);
      }

      const data = await response.json();
      const text = data.content[0].text;
      const jsonMatch = text.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        throw new Error("Claude returned invalid JSON format");
      }

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error("[AI] Claude generation failed:", error.message);
      window.dispatchEvent(new CustomEvent("ai-fallback", {
        detail: { reason: error.message },
      }));
      return null;
    }
  }

  async function generateDesign(prompt, garmentType) {
    if (!prompt || typeof prompt !== "string") {
      throw new Error("Prompt must be a non-empty string");
    }

    await new Promise((r) => setTimeout(r, 500 + Math.random() * 700));

    try {
      const type = garmentType || detectType(prompt) || "tshirt";
      CONFIG.validateGarmentType(type);

      // Server-side proxy first (secure), then the demo browser-key path,
      // then the local keyword generator as a final fallback.
      const claudeResult =
        (await generateWithServer(prompt, type)) ||
        (await generateWithClaude(prompt, type));

      if (claudeResult) {
        return {
          ...claudeResult,
          type,
          originalPrompt: prompt,
          generatedAt: new Date().toISOString(),
          designId: generateDesignId(),
        };
      }

      // Fallback to local generation
      const color = detectColor(prompt);
      const material = detectMaterial(prompt);
      const fit = detectFit(prompt);
      const pattern = detectPattern(prompt);
      const secondaryColor =
        pattern !== "solid" ? detectSecondaryColor(prompt, color) : color;
      const tags = extractTags(prompt);
      const name = generateName(type);
      const constructionNotes = generateConstructionNotes(type);

      return {
        name,
        description: t("ai.fallback_desc"),
        type,
        color,
        secondaryColor,
        material,
        fit,
        pattern,
        tags,
        constructionNotes,
        originalPrompt: prompt,
        generatedAt: new Date().toISOString(),
        designId: generateDesignId(),
      };
    } catch (error) {
      console.error("[AI] Design generation failed:", error);
      if (window.Sentry) window.Sentry.captureException(error, { tags: { area: "ai" } });
      throw new Error(`Design generation failed: ${error.message}`);
    }
  }

  function generateDesignId() {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `UR-${timestamp}-${random}`;
  }

  function extractTags(prompt) {
    const tags = new Set();
    const keywords = [
      "minimalistisch",
      "streetwear",
      "casual",
      "elegant",
      "vintage",
      "modern",
      "sportlich",
      "business",
      "cyberpunk",
      "gothic",
      "sommerlich",
      "winter",
      "gestickt",
      "bedruckt",
      "reflektierend",
      "wasserdicht",
      "gefüttert",
      "organic",
      "bio",
      "nachhaltig",
      "fairtrade",
      "handgefertigt",
    ];
    const lower = prompt.toLowerCase();
    keywords.forEach((kw) => {
      if (lower.includes(kw)) tags.add(kw);
    });
    return Array.from(tags);
  }

  return {
    generateDesign,
    detectType,
    detectColor,
    detectMaterial,
    detectFit,
    detectPattern,
  };
})();

if (typeof window !== "undefined") window.AI = AI;
if (typeof module !== "undefined" && module.exports) module.exports = AI;
