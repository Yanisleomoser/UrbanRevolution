/* Portfolio-Studie „Mira Solane" — Motion-Layer.
   GSAP + ScrollTrigger (CDN, classic scripts). Ohne GSAP oder mit
   prefers-reduced-motion bleibt die Seite vollständig statisch lesbar:
   die versteckenden Grundzustände hängen an html.has-js. */
(() => {
    "use strict";

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const hasGsap = typeof window.gsap !== "undefined" && typeof window.ScrollTrigger !== "undefined";

    /* ---------- Canvas-Ambiente: treibende Partikel in Markenfarben ---------- */
    const canvas = document.getElementById("ambience");
    const ctx = canvas ? canvas.getContext("2d") : null;
    if (ctx) {
        const COLORS = ["#2779a8", "#2a9d8f", "#64d6c4"];
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        let w = 0, h = 0, particles = [], raf = 0;

        const resize = () => {
            w = window.innerWidth;
            h = window.innerHeight;
            canvas.width = w * dpr;
            canvas.height = h * dpr;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            const count = Math.round(Math.min(110, (w * h) / 16000));
            particles = Array.from({ length: count }, () => ({
                x: Math.random() * w,
                y: Math.random() * h,
                r: 0.6 + Math.random() * 1.8,
                vx: -0.08 + Math.random() * 0.16,
                vy: -0.12 - Math.random() * 0.18,
                a: 0.08 + Math.random() * 0.3,
                c: COLORS[(Math.random() * COLORS.length) | 0],
                tw: Math.random() * Math.PI * 2,
            }));
        };

        const draw = (t) => {
            ctx.clearRect(0, 0, w, h);
            // Zwei langsam atmende Farbinseln als Tiefenebene
            const breathe = reduceMotion ? 0 : Math.sin(t / 4000) * 0.04;
            const glow = (x, y, radius, color, alpha) => {
                const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
                g.addColorStop(0, color);
                g.addColorStop(1, "transparent");
                ctx.globalAlpha = alpha;
                ctx.fillStyle = g;
                ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
            };
            glow(w * 0.16, h * 0.85, Math.max(w, h) * 0.5, "#2779a8", 0.1 + breathe);
            glow(w * 0.85, h * 0.15, Math.max(w, h) * 0.42, "#2a9d8f", 0.08 - breathe);

            ctx.globalCompositeOperation = "lighter";
            for (const p of particles) {
                if (!reduceMotion) {
                    p.x += p.vx;
                    p.y += p.vy;
                    p.tw += 0.015;
                    if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; }
                    if (p.x < -10) p.x = w + 10;
                    if (p.x > w + 10) p.x = -10;
                }
                ctx.globalAlpha = p.a * (0.6 + 0.4 * Math.sin(p.tw));
                ctx.fillStyle = p.c;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalCompositeOperation = "source-over";
            ctx.globalAlpha = 1;
        };

        const loop = (t) => {
            draw(t);
            raf = requestAnimationFrame(loop);
        };

        resize();
        window.addEventListener("resize", resize);
        if (reduceMotion) {
            draw(0); // ein statisches Standbild, keine Bewegung
        } else {
            raf = requestAnimationFrame(loop);
            document.addEventListener("visibilitychange", () => {
                if (document.hidden) {
                    cancelAnimationFrame(raf);
                } else {
                    raf = requestAnimationFrame(loop);
                }
            });
        }
    }

    /* ---------- Manifest in Wort-Spans zerlegen (für den Scrub) ---------- */
    const manifesto = document.getElementById("manifesto");
    if (manifesto && hasGsap && !reduceMotion) {
        const words = manifesto.textContent.trim().split(/\s+/);
        manifesto.textContent = "";
        for (const word of words) {
            const s = document.createElement("span");
            s.className = "w";
            s.textContent = word;
            manifesto.append(s, " ");
        }
    }

    /* ---------- GSAP-Choreografie ---------- */
    if (!hasGsap || reduceMotion) return; // CSS-Fallback zeigt alles statisch

    document.documentElement.classList.add("has-js");
    gsap.registerPlugin(ScrollTrigger);

    // Hero-Intro: Zeilen aus der Maske, dann Eyebrow/Sub/CTA
    const intro = gsap.timeline({ defaults: { ease: "power3.out" } });
    intro
        .to(".hero-title .line-inner", {
            y: 0,
            duration: 1.1,
            stagger: 0.12,
            delay: 0.15,
        })
        .to("[data-intro]", {
            opacity: 1,
            duration: 0.9,
            stagger: 0.1,
        }, "-=0.55");

    // Abschnitts-Reveals
    gsap.utils.toArray("[data-reveal]").forEach((el) => {
        gsap.to(el, {
            opacity: 1,
            y: 0,
            duration: 0.9,
            ease: "power3.out",
            scrollTrigger: { trigger: el, start: "top 86%" },
        });
    });

    // Manifest: Wort für Wort beim Scrollen aufhellen
    const wordSpans = document.querySelectorAll("#manifesto .w");
    if (wordSpans.length) {
        gsap.to(wordSpans, {
            opacity: 1,
            stagger: 0.04,
            ease: "none",
            scrollTrigger: {
                trigger: "#manifesto",
                start: "top 78%",
                end: "bottom 45%",
                scrub: 0.6,
            },
        });
    }

    // Work-Visuals: sanfte Parallaxe in der Karte
    gsap.utils.toArray(".work-visual").forEach((el) => {
        gsap.fromTo(el, { y: 26 }, {
            y: -26,
            ease: "none",
            scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: 0.8 },
        });
    });
})();
