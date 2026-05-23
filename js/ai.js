/**
 * Urban Revolution — AI Design Generator
 *
 * Generiert ein strukturiertes Designkonzept aus einem freien Text-Prompt.
 * Erkennt Farbe, Material, Schnitt, Muster, Logos, Längen-Details und
 * generiert die passenden visuellen Features für das 3D-Modell.
 * Integriert mit der Anthropic Claude API wenn ein Key vorhanden ist
 * (window.URBAN_REVOLUTION_API_KEY).
 */

const AI = (() => {
    const COLOR_DICT = {
        schwarz: '#1a1a1a', black: '#1a1a1a', anthrazit: '#27272a',
        weiss: '#ffffff', weiß: '#fafafa', white: '#fafafa', creme: '#f5e9d3', cream: '#f5e9d3', ivory: '#fffef0',
        rot: '#dc2626', red: '#dc2626', kirsch: '#9d0e0e', burgund: '#7f1d1d', burgundy: '#7f1d1d', weinrot: '#7f1d1d',
        blau: '#1e3a8a', blue: '#1e3a8a', marine: '#0c1e4d', navy: '#0c1e4d', royal: '#1e40af', himmelblau: '#3b82f6', babyblau: '#7dd3fc',
        türkis: '#0891b2', tuerkis: '#0891b2', turquoise: '#0891b2',
        grün: '#365314', gruen: '#365314', green: '#365314', oliv: '#3f4d20', olive: '#3f4d20',
        mintgrün: '#86efac', mint: '#86efac', tannengrün: '#14532d', forest: '#14532d',
        gelb: '#facc15', yellow: '#facc15', senf: '#a16207', mustard: '#a16207', ocker: '#a16207',
        orange: '#ea580c', terracotta: '#9a3412', terrakotta: '#9a3412', koralle: '#fb7185', coral: '#fb7185',
        beige: '#d4b896', braun: '#7c2d12', brown: '#7c2d12', schokolade: '#3f1b09', sand: '#e5d3b3',
        violett: '#6b21a8', purple: '#6b21a8', lila: '#7e22ce', flieder: '#c084fc', lavender: '#c4b5fd',
        pink: '#ec4899', rosa: '#fb7185', magenta: '#d946ef', hotpink: '#f472b6',
        grau: '#52525b', gray: '#52525b', grey: '#52525b', silber: '#a1a1aa', silver: '#a1a1aa', hellgrau: '#a1a1aa',
        neon: '#a3e635', cyber: '#7c3aed', neongelb: '#facc15', neongrün: '#4ade80', neonrosa: '#f0abfc',
        indigo: '#312e81', cyan: '#06b6d4',
        gold: '#ca8a04', kupfer: '#b45309'
    };

    const MATERIAL_DICT = {
        baumwolle: 'cotton', cotton: 'cotton', pima: 'cotton', jersey: 'cotton',
        leinen: 'linen', linen: 'linen', leinenmix: 'linen',
        denim: 'denim', jeans: 'denim', selvedge: 'denim',
        wolle: 'wool', wool: 'wool', kaschmir: 'wool', merino: 'wool', tweed: 'wool',
        fleece: 'fleece', sweat: 'fleece', frottee: 'fleece',
        seide: 'silk', silk: 'silk', satin: 'silk', viskose: 'silk',
        polyester: 'polyester', recycelt: 'polyester', recycled: 'polyester', nylon: 'polyester', techwear: 'polyester'
    };

    const TYPE_DICT = {
        hoodie: 'hoodie', kapuze: 'hoodie', sweater: 'hoodie', sweatshirt: 'hoodie',
        hemd: 'shirt', shirt: 'shirt', oxford: 'shirt', bluse: 'shirt', polo: 'shirt',
        't-shirt': 'tshirt', tshirt: 'tshirt', 'tee': 'tshirt', shirt_short: 'tshirt',
        hose: 'pants', jeans: 'pants', pants: 'pants', chino: 'pants', cargo: 'pants', trouser: 'pants',
        jacke: 'jacket', jacket: 'jacket', blazer: 'jacket', mantel: 'jacket', parka: 'jacket', bomber: 'jacket',
        kleid: 'dress', dress: 'dress', robe: 'dress'
    };

    const FIT_DICT = {
        skinny: 0.05, ultraslim: 0.05,
        slim: 0.18, tailliert: 0.22, schmal: 0.18, eng: 0.12, fitted: 0.2,
        regular: 0.5, klassisch: 0.5, standard: 0.5,
        relaxed: 0.65, loose: 0.75, weit: 0.78, locker: 0.7,
        oversized: 0.93, übergross: 0.93, uebergross: 0.93, baggy: 0.92
    };

    const PATTERN_KEYWORDS = {
        gestreift: 'stripes_h', streifen: 'stripes_h', striped: 'stripes_h',
        längsstreifen: 'stripes_v', laengsstreifen: 'stripes_v', vertical: 'stripes_v',
        gepunktet: 'dots', punkte: 'dots', polka: 'dots', dots: 'dots',
        kariert: 'plaid', karo: 'plaid', plaid: 'plaid', check: 'plaid',
        camo: 'camo', tarnmuster: 'camo', camouflage: 'camo',
        gradient: 'gradient', verlauf: 'gradient', ombre: 'gradient',
        floral: 'floral', blumen: 'floral', blümchen: 'floral',
        meliert: 'heather', heather: 'heather'
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
        return extractFromPrompt(prompt, COLOR_DICT) || '#1a1a1a';
    }

    function detectMaterial(prompt) {
        return extractFromPrompt(prompt, MATERIAL_DICT) || 'cotton';
    }

    function detectType(prompt) {
        return extractFromPrompt(prompt, TYPE_DICT);
    }

    function detectFit(prompt) {
        const fit = extractFromPrompt(prompt, FIT_DICT);
        return fit !== null ? fit : 0.5;
    }

    function detectPattern(prompt) {
        return extractFromPrompt(prompt, PATTERN_KEYWORDS) || 'solid';
    }

    function detectSecondaryColor(prompt, primaryColor) {
        const lower = prompt.toLowerCase();
        // Suche nach Phrasen wie "mit weißen Streifen", "mit roten Akzenten"
        const phrases = [
            /mit\s+(\w+en)\s+(streifen|akzenten|stickerei|details|kontrast)/i,
            /(\w+)\s+(streifen|akzent|kontrast)/i,
            /und\s+(\w+)/i
        ];
        for (const re of phrases) {
            const match = prompt.match(re);
            if (match) {
                for (const word of match.slice(1)) {
                    const norm = word.toLowerCase().replace(/(en|er|es|e)$/, '');
                    for (const [key, val] of Object.entries(COLOR_DICT)) {
                        if (norm.includes(key) || key.includes(norm)) {
                            if (val !== primaryColor) return val;
                        }
                    }
                }
            }
        }
        // Fallback: pick contrasting color
        return primaryColor === '#fafafa' ? '#1a1a1a' : '#fafafa';
    }

    function detectSleeve(prompt) {
        const lower = prompt.toLowerCase();
        if (/ärmellos|aermellos|sleeveless|tank|trägerlos/i.test(lower)) return 'sleeveless';
        if (/3\/4|dreiviertel|three.?quarter/i.test(lower)) return 'three_quarter';
        if (/kurzarm|kurze ärmel|short sleeve/i.test(lower)) return 'short';
        if (/langarm|lange ärmel|long sleeve/i.test(lower)) return 'long';
        return null;
    }

    function detectLength(prompt) {
        const lower = prompt.toLowerCase();
        if (/cropped|bauchfrei|kurz geschnitten/i.test(lower)) return 'cropped';
        if (/extralang|lang geschnitten|long line/i.test(lower)) return 'long';
        if (/maxi|bodenlang/i.test(lower)) return 'maxi';
        if (/mini/i.test(lower)) return 'mini';
        if (/midi|knielang/i.test(lower)) return 'midi';
        return 'regular';
    }

    function detectGraphicText(prompt) {
        const lower = prompt.toLowerCase();
        // Sucht nach Anführungszeichen oder bestimmten Schlüsselwörtern
        const quoted = prompt.match(/["„«»]([^"„«»]+)["„«»]/);
        if (quoted) return quoted[1].toUpperCase().slice(0, 18);
        if (/cyberpunk|cyber/i.test(lower)) return 'CYBER';
        if (/streetwear|street/i.test(lower)) return 'STREET';
        if (/skater|skate/i.test(lower)) return 'SK8';
        if (/love|liebe/i.test(lower)) return 'LOVE';
        if (/peace|frieden/i.test(lower)) return 'PEACE';
        if (/logo|emblem|stickerei|graphic|grafik|print|aufdruck/i.test(lower)) return 'UR';
        return null;
    }

    function detectDetails(prompt) {
        const lower = prompt.toLowerCase();
        return {
            hasHoodUp: /kapuze auf|hood up/i.test(lower),
            hasZipper: /reissverschluss|reißverschluss|zipper|zip/i.test(lower),
            hasPocket: /tasche|pocket|känguru|kangaroo/i.test(lower),
            hasCollar: /kragen|collar|button.?down/i.test(lower),
            isReflective: /reflektierend|reflektierende|reflective/i.test(lower),
            isDistressed: /distressed|destroyed|used.?look|vintage/i.test(lower),
            isEmbroidered: /gestickt|stickerei|embroidered/i.test(lower)
        };
    }

    function extractTags(prompt) {
        const tags = new Set();
        const keywords = [
            'minimalistisch', 'streetwear', 'casual', 'elegant', 'vintage', 'modern',
            'sportlich', 'business', 'cyberpunk', 'gothic', 'sommerlich', 'winter',
            'gestickt', 'bedruckt', 'reflektierend', 'wasserdicht', 'gefüttert',
            'organic', 'bio', 'nachhaltig', 'fairtrade', 'handgefertigt'
        ];
        const lower = prompt.toLowerCase();
        keywords.forEach(kw => { if (lower.includes(kw)) tags.add(kw); });
        return Array.from(tags);
    }

    function generateName(type) {
        const adjectives = {
            tshirt: ['Essential', 'Signature', 'Classic', 'Urban', 'Studio'],
            hoodie: ['Atelier', 'Heritage', 'Urban', 'Street', 'Cult'],
            shirt: ['Manhattan', 'Riviera', 'Atelier', 'Heritage', 'Sartorial'],
            pants: ['Modular', 'Tokyo', 'Heritage', 'Workwear', 'Studio'],
            jacket: ['Bauhaus', 'Brutalist', 'Atelier', 'Heritage', 'Modular'],
            dress: ['Soirée', 'Atelier', 'Riviera', 'Modern', 'Sculptural']
        };
        const typeNames = {
            tshirt: 'Tee', hoodie: 'Hoodie', shirt: 'Hemd',
            pants: 'Pants', jacket: 'Jacket', dress: 'Kleid'
        };
        const adj = adjectives[type] || adjectives.tshirt;
        const chosen = adj[Math.floor(Math.random() * adj.length)];
        return `${chosen} ${typeNames[type] || 'Piece'}`;
    }

    function generateConstructionNotes(type) {
        const notes = {
            tshirt: [
                'Rundhalsausschnitt mit gerippter Halsblende, 2cm breit',
                'Seitennähte mit doppelter Steppung für Strapazierfähigkeit',
                'Saum 2.5cm umgeschlagen und gesteppt',
                'Schulternaht mit Kontrastband verstärkt'
            ],
            hoodie: [
                'Kapuze doppellagig mit gefütterten Innenseiten',
                'Känguru-Tasche mit zwei Seiteneingriffen',
                'Bündchen aus Rib-Strick an Saum und Ärmeln, 6cm',
                'Tunnelzug mit Metallösen und 1cm Flachkordel'
            ],
            shirt: [
                'Button-Down Kragen mit Einlage',
                'Knopfleiste 3cm breit, 7 Knöpfe à 11mm Perlmutt',
                'Doppelte Manschette mit zwei Knöpfen',
                'Rückenpasse mit Mittelfalte 4cm',
                'Französische Nähte an Seiten und Ärmeleinsatz'
            ],
            pants: [
                'Fünf-Taschen-Konstruktion klassisch',
                'Reißverschluss YKK Metall, Knopfverschluss am Bund',
                'Bundhöhe vorne 22cm, hinten 28cm (Mid-Rise)',
                'Saum mit Kettenstich gesäumt für authentischen Look'
            ],
            jacket: [
                'Vollfutter mit Innentaschen (links, rechts)',
                'Schulterpolster 8mm dezent',
                'Reverskragen mit Knopflochstickerei',
                'Zwei Eingrifftaschen mit Klappe',
                'Ärmel-Knopfleiste mit 3 Knöpfen'
            ],
            dress: [
                'Verdeckter Reißverschluss am Rücken, YKK 50cm',
                'Brustabnäher und Taillen-Princessnähte',
                'Saum 5cm doppelt umgeschlagen, blind gesteppt'
            ]
        };
        return notes[type] || notes.tshirt;
    }

    function generateDescription(prompt, color, material, pattern, graphic) {
        const colorWord = Object.entries(COLOR_DICT).find(([_, v]) => v === color)?.[0] || 'individuell';
        const materialWord = Object.entries(MATERIAL_DICT).find(([_, v]) => v === material)?.[0] || 'hochwertig';

        const intro = `${materialWord.charAt(0).toUpperCase() + materialWord.slice(1)} in ${colorWord}, präzise verarbeitet.`;
        const mid = pattern === 'solid'
            ? 'Klare Linien, reduziertes Design, maßgeschneidert für deine Proportionen.'
            : `Mit charakteristischem ${pattern.replace('_', '-')}-Muster, das jedem Outfit Persönlichkeit verleiht.`;
        const end = graphic
            ? `Aufdruck "${graphic}" als Statement.`
            : 'Jedes Detail bewusst gestaltet — ein Unikat für dich.';
        return `${intro} ${mid} ${end}`;
    }

    async function generateWithClaude(prompt, type) {
        const apiKey = window.URBAN_REVOLUTION_API_KEY;
        if (!apiKey) return null;
        try {
            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01',
                    'anthropic-dangerous-direct-browser-access': 'true'
                },
                body: JSON.stringify({
                    model: 'claude-sonnet-4-6',
                    max_tokens: 1024,
                    messages: [{
                        role: 'user',
                        content: `Du bist Designer für Urban Revolution. Erstelle ein JSON-Design-Konzept für: "${prompt}". Kleidungstyp: ${type}.

Antworte NUR mit JSON:
{
  "name": "Designname (max 4 Wörter)",
  "description": "2-3 Sätze, Deutsch",
  "color": "#hexcode",
  "secondaryColor": "#hexcode (für Muster/Akzent, kontrastierend)",
  "material": "cotton|linen|denim|wool|fleece|silk|polyester",
  "fit": 0.0 bis 1.0,
  "pattern": "solid|stripes_h|stripes_v|dots|plaid|camo|gradient|heather",
  "graphicText": "Text auf dem Stück oder null (max 12 Zeichen)",
  "sleeve": "short|long|three_quarter|sleeveless|null",
  "length": "regular|cropped|long|midi|maxi",
  "details": {"hasZipper":false,"hasPocket":false,"hasHoodUp":false,"isReflective":false,"isEmbroidered":false},
  "tags": ["tag1","tag2","tag3"],
  "constructionNotes": ["Note 1","Note 2","Note 3"]
}`
                    }]
                })
            });
            if (!response.ok) return null;
            const data = await response.json();
            const text = data.content[0].text;
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) return JSON.parse(jsonMatch[0]);
        } catch (e) {
            console.warn('Claude API fallback:', e);
        }
        return null;
    }

    async function generateDesign(prompt, garmentType) {
        await new Promise(r => setTimeout(r, 500 + Math.random() * 700));

        const type = garmentType || detectType(prompt) || 'tshirt';
        const claudeResult = await generateWithClaude(prompt, type);

        if (claudeResult) {
            return {
                ...claudeResult,
                type,
                originalPrompt: prompt,
                generatedAt: new Date().toISOString(),
                designId: 'UR-' + Math.random().toString(36).substring(2, 8).toUpperCase()
            };
        }

        const color = detectColor(prompt);
        const material = detectMaterial(prompt);
        const fit = detectFit(prompt);
        const pattern = detectPattern(prompt);
        const secondaryColor = pattern !== 'solid' ? detectSecondaryColor(prompt, color) : color;
        const graphicText = detectGraphicText(prompt);
        const sleeve = detectSleeve(prompt);
        const length = detectLength(prompt);
        const details = detectDetails(prompt);
        const tags = extractTags(prompt);
        const name = generateName(type);
        const description = generateDescription(prompt, color, material, pattern, graphicText);
        const constructionNotes = generateConstructionNotes(type);

        return {
            name,
            description,
            type,
            color,
            secondaryColor,
            material,
            fit,
            pattern,
            graphicText,
            sleeve,
            length,
            details,
            tags,
            constructionNotes,
            originalPrompt: prompt,
            generatedAt: new Date().toISOString(),
            designId: 'UR-' + Math.random().toString(36).substring(2, 8).toUpperCase()
        };
    }

    return {
        generateDesign,
        detectType,
        detectColor,
        detectMaterial,
        detectFit,
        detectPattern
    };
})();

window.AI = AI;
