/**
 * Thermal-Waves — die bewegte Wärmebild-Bühne des Heros (#thermal-waves).
 *
 * Raw-WebGL-Fragment-Shader (keine Library): domain-warped fBm formt langsam
 * fliessende Thermal-Wellen in der Slide-Palette (Indigo → Periwinkle → Teal →
 * Leucht-Grün → Gold → Orange auf Nachtschwarz), ein wandernder Glut-Kern
 * trägt die Akt-I-Wärme, Filmkorn ist in den Shader gebacken. Ersetzt das
 * frühere Faden-Partikelfeld (initWeave) als Hero-Visual.
 *
 * Performance-Bauart (der Grund für WebGL statt SVG-Filter/Canvas-2D):
 * gerendert wird in HALBER Auflösung (DPR-gedeckelt) und per CSS hochskaliert
 * — die Weichheit ist gewollt (Slide-Look). rAF pausiert offscreen und bei
 * verstecktem Tab; ~30 fps genügen der trägen Bewegung. Ein statischer Frame
 * wird IMMER gezeichnet — unter prefers-reduced-motion bleibt er stehen
 * (vollständige, ruhende Szene statt Bewegung).
 *
 * Progressive Enhancement: ohne JS/WebGL bleibt das Fallback-Raster
 * (.lp-hero-blob, assets/tblob-thermal.webp) die komplette Szene. Erst wenn
 * der erste Frame gezeichnet ist, setzt das Modul html.tw-live und blendet
 * das Raster aus. Klassisches Side-Effect-Modul (kein Global), wie
 * facts-mass.js / faden.js.
 */
(() => {
    "use strict";

    const boot = () => {
        const canvas = document.getElementById("thermal-waves");
        if (!canvas) return;
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        let gl = null;
        try {
            gl = canvas.getContext("webgl", { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: "low-power" });
        } catch (_) { /* Fallback-Raster bleibt */ }
        if (!gl) return;

        const VERT = "attribute vec2 aP;void main(){gl_Position=vec4(aP,0.,1.);}";
        const FRAG = `precision mediump float;
uniform vec2 uRes;
uniform float uT;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
float noise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p){
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
    return v;
}

void main(){
    vec2 uv = gl_FragCoord.xy / uRes;
    vec2 p = (uv - 0.5) * vec2(uRes.x / uRes.y, 1.0) * 1.7;
    float t = uT * 0.045;

    /* Domain-Warp: zwei fBm-Felder verschieben das dritte — die Wellen
       fliessen organisch statt zu wabern. */
    vec2 q = vec2(fbm(p + vec2(0.0, t)), fbm(p + vec2(5.2, 1.3) - t * 0.6));
    vec2 r = vec2(fbm(p + 2.0 * q + vec2(1.7, 9.2) + t * 0.30),
                  fbm(p + 2.0 * q + vec2(8.3, 2.8) - t * 0.22));
    float f = fbm(p + 2.2 * r);

    /* Bühnen-Maske: die Masse lebt oben rechts, die Ränder schmelzen in
       Schwarz. Dazu eine COPY-SCHUTZ-ZONE, damit Kleintext/CTAs immer auf
       dunklem Grund stehen: Landscape dunkelt die linke Spalte ab, Portrait
       (Mobil) die untere Hälfte (dort sitzen Sub/CTAs/Formular). */
    float portrait = step(uRes.x, uRes.y);
    vec2 c1 = mix(vec2(0.64, 0.60), vec2(0.68, 0.80), portrait);
    float m = smoothstep(1.25, 0.25, length((uv - c1) * vec2(1.15, 1.45)));
    float guard = mix(0.16 + 0.84 * smoothstep(0.14, 0.55, uv.x),
                      0.18 + 0.82 * smoothstep(0.38, 0.85, uv.y), portrait);
    float h = f * (0.30 + 0.80 * m) * guard;

    /* Wandernder Glut-Kern (Akt-I-Wärme): kreist langsam rechts der Copy-
       Spalte (Portrait: als Glimmen in der unteren linken Ecke, gross-
       teils beschnitten); die Rampe zeichnet Grün-Saum + Gold-Ring selbst. */
    vec2 core = mix(vec2(0.60 + 0.09 * sin(t * 0.7), 0.30 + 0.08 * sin(t * 0.53 + 1.7)),
                    vec2(0.12 + 0.06 * sin(t * 0.7), 0.05 + 0.04 * sin(t * 0.53 + 1.7)), portrait);
    h += 0.42 * exp(-dot(uv - core, uv - core) * 26.0) * (0.75 + 0.25 * sin(t * 1.1));

    vec3 col = vec3(0.043, 0.043, 0.051);                                   /* #0b0b0d */
    col = mix(col, vec3(0.118, 0.133, 0.275), smoothstep(0.10, 0.32, h));   /* Indigo  */
    col = mix(col, vec3(0.333, 0.376, 0.722), smoothstep(0.30, 0.52, h));   /* Peri    */
    col = mix(col, vec3(0.561, 0.588, 0.910), smoothstep(0.50, 0.64, h));   /* hell    */
    col = mix(col, vec3(0.071, 0.639, 0.478), smoothstep(0.62, 0.74, h));   /* Teal    */
    col = mix(col, vec3(0.494, 0.863, 0.180), smoothstep(0.72, 0.82, h));   /* Grün    */
    col = mix(col, vec3(0.961, 0.753, 0.314), smoothstep(0.81, 0.89, h));   /* Gold    */
    col = mix(col, vec3(0.937, 0.486, 0.149), smoothstep(0.88, 0.97, h));   /* Orange  */

    /* Filmkorn (bewegt sich mit der Zeit — Zelluloid, nicht Raster) */
    col += (hash(gl_FragCoord.xy + fract(uT * 0.7) * 61.0) - 0.5) * 0.07;

    gl_FragColor = vec4(col, 1.0);
}`;

        const compile = (type, src) => {
            const sh = gl.createShader(type);
            gl.shaderSource(sh, src);
            gl.compileShader(sh);
            if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) return null;
            return sh;
        };
        const vs = compile(gl.VERTEX_SHADER, VERT);
        const fs = compile(gl.FRAGMENT_SHADER, FRAG);
        if (!vs || !fs) return;
        const prog = gl.createProgram();
        gl.attachShader(prog, vs);
        gl.attachShader(prog, fs);
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
        gl.useProgram(prog);
        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        const aP = gl.getAttribLocation(prog, "aP");
        gl.enableVertexAttribArray(aP);
        gl.vertexAttribPointer(aP, 2, gl.FLOAT, false, 0, 0);
        const uRes = gl.getUniformLocation(prog, "uRes");
        const uT = gl.getUniformLocation(prog, "uT");

        /* Halbe Auflösung, DPR-gedeckelt — Weichheit gewollt, Kosten klein. */
        const SCALE = 0.5;
        const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
        const resize = () => {
            const w = Math.max(2, Math.round(canvas.clientWidth * DPR * SCALE));
            const hh = Math.max(2, Math.round(canvas.clientHeight * DPR * SCALE));
            if (canvas.width !== w || canvas.height !== hh) {
                canvas.width = w;
                canvas.height = hh;
                gl.viewport(0, 0, w, hh);
            }
        };

        const draw = (tSec) => {
            resize();
            gl.uniform2f(uRes, canvas.width, canvas.height);
            gl.uniform1f(uT, tSec);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
        };

        /* Erster Frame sofort (ruhende Szene), dann Übergabe an die Schleife. */
        draw(34.0);
        document.documentElement.classList.add("tw-live");
        if (reduced) return; /* reduced-motion: der stehende Frame IST die Szene */

        let visible = true;
        let tabVisible = !document.hidden;
        let raf = 0;
        let last = 0;
        const STEP = 1000 / 30; /* ~30 fps genügen der trägen Bewegung */
        const loop = (ms) => {
            raf = 0;
            if (!visible || !tabVisible) return;
            if (ms - last >= STEP) {
                last = ms;
                draw(34.0 + ms / 1000);
            }
            raf = requestAnimationFrame(loop);
        };
        const wake = () => { if (!raf && visible && tabVisible) raf = requestAnimationFrame(loop); };

        if ("IntersectionObserver" in window) {
            new IntersectionObserver((es) => {
                visible = es[0].isIntersecting;
                wake();
            }, { threshold: 0.02 }).observe(canvas);
        }
        document.addEventListener("visibilitychange", () => {
            tabVisible = !document.hidden;
            wake();
        });
        window.addEventListener("resize", () => { if (!raf) draw(34.0 + performance.now() / 1000); });
        wake();
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot, { once: true });
    } else {
        boot();
    }
})();
