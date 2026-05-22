/**
 * Urban Revolution — AI Design Generator
 *
 * Generiert ein strukturiertes Designkonzept aus einem freien Text-Prompt.
 * Integriert mit der Anthropic Claude API wenn ein Key vorhanden ist
 * (window.URBAN_REVOLUTION_API_KEY). Andernfalls fällt das Modul auf einen
 * lokalen, semantischen Generator zurück, sodass die Demo immer funktioniert.
 */

const AI = (() => {
    const COLOR_DICT = {
        schwarz: '#1a1a1a', black: '#1a1a1a',
        weiss: '#ffffff', weiß: '#ffffff', white: '#ffffff',
        rot: '#dc2626', red: '#dc2626',
        blau: '#1e3a8a', blue: '#1e3a8a',
        marine: '#1e3a8a', navy: '#1e3a8a',
        grün: '#365314', gruen: '#365314', green: '#365314', oliv: '#365314', olive: '#365314',
        gelb: '#f59e0b', yellow: '#f59e0b',
        beige: '#a16207', braun: '#7c2d12', brown: '#7c2d12',
        violett: '#6b21a8', purple: '#6b21a8', lila: '#6b21a8',
        pink: '#831843', rosa: '#831843',
        grau: '#6b7280', gray: '#6b7280',
        neon: '#a3e635', cyber: '#6b21a8',
        indigo: '#1e3a8a', cyan: '#06b6d4'
    };

    const MATERIAL_DICT = {
        baumwolle: 'cotton', cotton: 'cotton', pima: 'cotton',
        leinen: 'linen', linen: 'linen',
        denim: 'denim', jeans: 'denim',
        wolle: 'wool', wool: 'wool', kaschmir: 'wool',
        fleece: 'fleece', sweat: 'fleece',
        seide: 'silk', silk: 'silk', satin: 'silk',
        polyester: 'polyester', recycelt: 'polyester', recycled: 'polyester'
    };

    const TYPE_DICT = {
        hoodie: 'hoodie', kapuze: 'hoodie', sweater: 'hoodie',
        hemd: 'shirt', shirt: 'shirt', oxford: 'shirt', bluse: 'shirt',
        't-shirt': 'tshirt', tshirt: 'tshirt', tee: 'tshirt',
        hose: 'pants', jeans: 'pants', pants: 'pants', chino: 'pants', cargo: 'pants',
        jacke: 'jacket', jacket: 'jacket', blazer: 'jacket', mantel: 'jacket',
        kleid: 'dress', dress: 'dress', robe: 'dress'
    };

    const FIT_DICT = {
        slim: 0.15, tailliert: 0.2, schmal: 0.15, eng: 0.1,
        regular: 0.5, klassisch: 0.5,
        loose: 0.75, weit: 0.75, locker: 0.7,
        oversized: 0.95, übergross: 0.95, baggy: 0.9
    };

    function extractFromPrompt(prompt, dict) {
        const lower = prompt.toLowerCase();
        for (const [keyword, value] of Object.entries(dict)) {
            if (lower.includes(keyword)) return value;
        }
        return null;
    }

    function detectColor(prompt) {
        const color = extractFromPrompt(prompt, COLOR_DICT);
        return color || '#1a1a1a';
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

    function extractTags(prompt) {
        const tags = new Set();
        const keywords = [
            'minimalistisch', 'streetwear', 'casual', 'elegant', 'vintage', 'modern',
            'sportlich', 'business', 'cyberpunk', 'gothic', 'sommerlich', 'winter',
            'gestickt', 'bedruckt', 'reflektierend', 'wasserdicht', 'gefüttert',
            'taschen', 'kapuze', 'kragen', 'knopfleiste', 'reissverschluss',
            'organic', 'bio', 'nachhaltig', 'fairtrade', 'handgefertigt'
        ];
        const lower = prompt.toLowerCase();
        keywords.forEach(kw => { if (lower.includes(kw)) tags.add(kw); });
        return Array.from(tags);
    }

    function generateName(type, color, prompt) {
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

    function generateConstructionNotes(type, prompt) {
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
                'Reißverschluss YKK Metall #5 (falls Zipper-Hoodie)',
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
                'Saum mit Kettenstich gesäumt für authentischen Look',
                'Verstärkte Belastungspunkte mit Riegeln'
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
                'Saum 5cm doppelt umgeschlagen, blind gesteppt',
                'Optional: Unterkleid aus Viskose'
            ]
        };
        return notes[type] || notes.tshirt;
    }

    function generateDescription(prompt, type, color, material) {
        const colorWord = Object.entries(COLOR_DICT).find(([_, v]) => v === color)?.[0] || 'individuell';
        const materialWord = Object.entries(MATERIAL_DICT).find(([_, v]) => v === material)?.[0] || 'hochwertig';

        const intros = [
            `Ein Statement-Piece, das urbane Eleganz neu definiert.`,
            `Zeitgenössisches Design trifft auf handwerkliche Präzision.`,
            `Eine Hommage an minimalistische Ästhetik und Tragekomfort.`,
            `Reduzierte Linien, präzise Schnittführung, kompromisslose Qualität.`
        ];
        const middles = [
            `Gefertigt aus ${materialWord} in einem ${colorWord}-Ton, der je nach Lichteinfall changiert.`,
            `Das ${materialWord}-Material in ${colorWord} sorgt für angenehmes Tragegefühl bei jedem Anlass.`,
            `${materialWord.charAt(0).toUpperCase() + materialWord.slice(1)} in tiefem ${colorWord} bildet die Basis dieses Stücks.`
        ];
        const closers = [
            `Jedes Detail wurde nach deinen exakten Maßen gefertigt — eine perfekte Symbiose aus Vision und Passform.`,
            `Ein Unikat, gefertigt für dich und nur für dich.`,
            `Maßgeschneidert nach deinen Körpermaßen für eine zweite Haut.`
        ];

        return [
            intros[Math.floor(Math.random() * intros.length)],
            middles[Math.floor(Math.random() * middles.length)],
            closers[Math.floor(Math.random() * closers.length)]
        ].join(' ');
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
                        content: `Du bist ein Designer für Urban Revolution, ein AI-Couture-Atelier. Erstelle ein JSON-Design-Konzept für folgenden Wunsch: "${prompt}". Der Kleidungstyp ist ${type}.

Antworte NUR mit JSON in genau diesem Format:
{
  "name": "Designname (maximal 4 Wörter)",
  "description": "2-3 Sätze, die das Design beschreiben (auf Deutsch)",
  "color": "#hexcode",
  "material": "cotton|linen|denim|wool|fleece|silk|polyester",
  "fit": 0.0 bis 1.0 (0=slim, 1=oversized),
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "constructionNotes": ["Note 1", "Note 2", "Note 3", "Note 4"]
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
        await new Promise(r => setTimeout(r, 600 + Math.random() * 800));

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
        const tags = extractTags(prompt);
        const name = generateName(type, color, prompt);
        const description = generateDescription(prompt, type, color, material);
        const constructionNotes = generateConstructionNotes(type, prompt);

        return {
            name,
            description,
            type,
            color,
            material,
            fit,
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
        detectFit
    };
})();

window.AI = AI;
