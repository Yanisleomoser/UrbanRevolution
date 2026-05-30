/**
 * Offscreen preview of the story formations (dev tool, not shipped).
 *
 * WebGL can't render in CI/headless, but the particle POSITIONS are pure
 * math. This mirrors the formation builders in js/3d/story-scene.js,
 * projects the points to a PNG, and writes them to /tmp so the shapes can
 * be eyeballed during iteration. It shows GEOMETRY (is the silhouette
 * human? is the heap solid?), not the live glow/blending.
 *
 * Run:  node scripts/preview-story.mjs   (needs `npm i sharp` available)
 * Keep in sync with story-scene.js when the formations change.
 */
import sharp from "sharp";
const COUNT = 7600, W = 600, H = 800;
const rnd = (a, b) => a + Math.random() * (b - a);

function buildHumanMask() {
    const MW = 220, MH = 460, buf = new Uint8Array(MW * MH), cx = MW / 2;
    const disc = (x, y, r) => {
        for (let yy = Math.max(0, (y - r) | 0); yy < Math.min(MH, y + r); yy++)
            for (let xx = Math.max(0, (x - r) | 0); xx < Math.min(MW, x + r); xx++) {
                const dx = xx - x, dy = yy - y;
                if (dx * dx + dy * dy <= r * r) buf[yy * MW + xx] = 1;
            }
    };
    const cap = (x1, y1, r1, x2, y2, r2) => {
        for (let i = 0; i <= 26; i++) {
            const t = i / 26;
            disc(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, r1 + (r2 - r1) * t);
        }
    };
    disc(cx, 56, 33); cap(cx, 88, 13, cx, 110, 17); cap(cx - 2, 116, 46, cx, 250, 34);
    cap(cx - 40, 126, 16, cx - 70, 250, 12); cap(cx - 70, 250, 12, cx - 78, 300, 9);
    cap(cx + 40, 126, 16, cx + 70, 250, 12); cap(cx + 70, 250, 12, cx + 78, 300, 9);
    cap(cx - 4, 250, 34, cx - 26, 300, 22); cap(cx - 26, 300, 20, cx - 30, 430, 13);
    cap(cx + 4, 250, 34, cx + 26, 300, 22); cap(cx + 26, 300, 20, cx + 30, 430, 13);
    const at = (x, y) => x >= 0 && y >= 0 && x < MW && y < MH && buf[y * MW + x];
    const pts = [];
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
        if (!at(x, y)) continue;
        const edge = !at(x - 1, y) || !at(x + 1, y) || !at(x, y - 1) || !at(x, y + 1);
        pts.push({ x: (x - cx) / 90, y: (MH * 0.52 - y) / 90, edge });
    }
    return pts;
}
const MASK = buildHumanMask();
const sampleSil = () => {
    const p = MASK[(Math.random() * MASK.length) | 0], d = p.edge ? 0.05 : 0.32;
    return { x: p.x + rnd(-0.012, 0.012), y: p.y + rnd(-0.012, 0.012), z: rnd(-d, d), edge: p.edge };
};

const bottle = () => { const o = []; for (let i = 0; i < COUNT; i++) { const u = Math.random(); let y, r; if (u < 0.66) { y = rnd(-1.7, 0.9); r = 0.62; } else if (u < 0.8) { const t = Math.random(); y = 0.9 + t * 0.5; r = 0.62 - t * 0.42; } else if (u < 0.94) { y = rnd(1.4, 1.9); r = 0.2; } else { y = rnd(1.9, 2.1); r = 0.26; } const a = rnd(0, 6.283), s = r * (0.9 + Math.random() * 0.1); o.push([Math.cos(a) * s, y, Math.sin(a) * s, 1]); } return o; };
const heap = () => { const o = [], R = 2.3, Hh = 3.4, B = -2.3; for (let i = 0; i < COUNT; i++) { const a = rnd(0, 6.283), r = Math.pow(Math.random(), 0.7) * R, surf = Hh * (1 - r / R), y = B + Math.random() * surf, j = 1 + rnd(-0.06, 0.06); o.push([Math.cos(a) * r * j, y, Math.sin(a) * r * 0.62 * j, 1]); } return o; };
const body = () => { const o = []; for (let i = 0; i < COUNT; i++) { if (Math.random() < 0.7) { const p = sampleSil(); o.push([p.x, p.y, p.z, p.edge ? 1.4 : 0.7]); } else o.push([rnd(-3, 3), rnd(-2.6, 2.6), rnd(-1.6, 1.6), 0.35]); } return o; };
const figure = () => { const o = []; for (let i = 0; i < COUNT; i++) { if (Math.random() < 0.05) { const a = rnd(0, 6.283), rr = rnd(0.35, 0.7); o.push([Math.cos(a) * rr * 0.6, rnd(0.6, 1.5), Math.sin(a) * rr - 0.55, 0.45]); } else { const p = sampleSil(); o.push([p.x, p.y, p.z, p.edge ? 1.3 : 0.7]); } } return o; };
const drift = () => { const o = []; for (let i = 0; i < COUNT; i++) { const lane = Math.floor(rnd(0, 26)); const ly = -2.4 + (lane / 25) * 4.8; const t = Math.random(); const x = -4.4 + t * 8.8; const wave = Math.sin(t * Math.PI * 3 + lane) * 0.35; const y = ly + wave + rnd(-0.12, 0.12); const z = Math.cos(t * Math.PI * 2 + lane) * 1.4 + rnd(-0.15, 0.15); const dens = Math.sin(t * Math.PI) * 0.7 + 0.3; o.push([x, y, z, 0.45 + dens * 0.6]); } return o; };
const THREADS = 56;
const threads = () => { const o = []; const perThread = Math.ceil(COUNT / THREADS); for (let i = 0; i < COUNT; i++) { const th = i % THREADS, baseX = ((th / (THREADS - 1)) - 0.5) * 4.8, phase = th * 1.7; const step = Math.floor(i / THREADS); const p = (step + Math.random() * 0.6) / perThread; const y = -2.9 + p * 5.8; const x = baseX + Math.sin(p * Math.PI * 2.4 + phase) * 0.45 + rnd(-0.02, 0.02); const z = Math.cos(p * Math.PI * 1.8 + phase) * 0.6 + rnd(-0.02, 0.02); o.push([x, y, z, 0.6 + p * 0.5]); } return o; };

async function render(name, pts) {
    const img = new Float32Array(W * H), scale = H / 6.2, ox = W / 2, oy = H / 2;
    for (const [x, y, z, b] of pts) {
        const px = (ox + x * scale) | 0, py = (oy - y * scale) | 0, br = b * (0.7 + 0.3 * (z + 0.5));
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            const xx = px + dx, yy = py + dy;
            if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
            img[yy * W + xx] += br * ((dx || dy) ? 0.4 : 1) * 0.5;
        }
    }
    const rgba = Buffer.alloc(W * H * 4);
    for (let i = 0; i < W * H; i++) { const v = Math.min(255, img[i] * 180); rgba[i * 4] = v * 0.55; rgba[i * 4 + 1] = v * 0.6; rgba[i * 4 + 2] = v; rgba[i * 4 + 3] = 255; }
    await sharp(rgba, { raw: { width: W, height: H, channels: 4 } }).png().toFile(`/tmp/prev_${name}.png`);
    console.log("wrote /tmp/prev_" + name + ".png");
}

await render("1_bottle", bottle());
await render("2_heap", heap());
await render("3_drift", drift());
await render("4_body", body());
await render("5_threads", threads());
await render("6_figure", figure());
