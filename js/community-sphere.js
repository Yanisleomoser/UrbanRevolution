/* ============================================================
   Community-Sphäre — die Kugel-Galerie der Community-Sektion

   Fotorealistische Kreationen schweben an der Innenwand einer
   Sphäre (Kamera im Zentrum). Ziehen/Pfeiltasten drehen den Blick
   mit Lenis-artigem Easing (exp. Lerp + Trägheit), Tippen öffnet
   das Design-Overlay; der Join-Flow lebt als CTA + Overlay im
   Erlebnis. Scroll bleibt frei: kein Wheel-Hijack, Canvas mit
   touch-action: pan-y (vertikales Wischen scrollt die Seite).

   Lazy: three/gsap (CDN-Import-Map) + Bilder laden erst, wenn die
   Sektion in Sichtweite scrollt. Datenquellen: /api/gallery-Items
   MIT img-Feld (sobald der Publish-Flow Bilder speichert) zuerst,
   aufgefüllt mit content/community-showcase.json (36 Engine-Renders).

   ES-Modul (einziges neben /gallery/) — bewusst nicht IIFE-classic,
   weil three.js nur als ESM ausgeliefert wird und der dynamische
   import() das Lazy-Loading trägt. Kein Build-Schritt.
   ============================================================ */

const section = document.getElementById("community");
const canvas = document.getElementById("community-canvas");
const detailEl = document.getElementById("sphere-detail");
const joinEl = document.getElementById("sphere-join");

const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
const FINE_POINTER = matchMedia("(pointer: fine)").matches;
const t = (key) => (window.I18N && window.I18N.t ? window.I18N.t(key) : key);

/* ---------- Overlays (unabhängig vom 3D-Boot funktionsfähig) ---------- */

let lastTrigger = null;
const trapReleases = new WeakMap(); // overlay el → FocusTrap release fn
const overlayOpen = () => Boolean(
    (detailEl && !detailEl.hidden) || (joinEl && !joinEl.hidden),
);

function openOverlay(el, trigger) {
    if (!el) return;
    lastTrigger = trigger || document.activeElement;
    el.hidden = false;
    requestAnimationFrame(() => el.classList.add("is-open"));
    document.documentElement.classList.add("sphere-lock");
    const close = el.querySelector(".sphere-close");
    if (close) close.focus({ preventScroll: true });
    // Contain Tab within the dialog (focus-in/return handled above + in close).
    if (window.FocusTrap) trapReleases.set(el, window.FocusTrap.activate(el));
}

function closeOverlay(el) {
    if (!el || el.hidden) return;
    el.classList.remove("is-open");
    const release = trapReleases.get(el);
    if (release) { release(); trapReleases.delete(el); }
    const done = () => {
        el.hidden = true;
        if (!overlayOpen()) document.documentElement.classList.remove("sphere-lock");
    };
    if (REDUCED) done();
    else setTimeout(done, 240); // an die 0.22/0.24s-CSS-Transition gekoppelt
    if (lastTrigger && document.contains(lastTrigger)) {
        lastTrigger.focus({ preventScroll: true });
    }
    lastTrigger = null;
    onOverlayClosed();
}

// Wird nach dem Boot mit der Szene verdrahtet (Karten ent-dimmen etc.).
let onOverlayClosed = () => {};

if (section && canvas && detailEl && joinEl) {
    const joinCta = document.getElementById("sphere-join-cta");
    if (joinCta) joinCta.addEventListener("click", () => openOverlay(joinEl, joinCta));

    const detailJoin = document.getElementById("sphere-detail-join");
    if (detailJoin) {
        detailJoin.addEventListener("click", () => {
            closeOverlay(detailEl);
            // Fokus-Rückkehr auf den sichtbaren Sektions-CTA (detailJoin liegt
            // im dann versteckten Detail-Overlay).
            openOverlay(joinEl, joinCta || detailJoin);
        });
    }

    const detailCreate = document.getElementById("sphere-detail-create");
    if (detailCreate) detailCreate.addEventListener("click", () => closeOverlay(detailEl));

    detailEl.querySelectorAll("[data-sphere-close]").forEach((b) =>
        b.addEventListener("click", () => closeOverlay(detailEl)));
    joinEl.querySelectorAll("[data-join-close]").forEach((b) =>
        b.addEventListener("click", () => closeOverlay(joinEl)));

    document.addEventListener("keydown", (e) => {
        if (e.key !== "Escape") return;
        if (!detailEl.hidden) closeOverlay(detailEl);
        else if (!joinEl.hidden) closeOverlay(joinEl);
    });

    // 3D erst booten, wenn die Sektion in Sichtweite scrollt.
    const lazy = new IntersectionObserver((entries) => {
        if (entries.some((en) => en.isIntersecting)) {
            lazy.disconnect();
            boot().catch((err) => console.error("[community-sphere]", err));
        }
    }, { rootMargin: "900px 0px" });
    lazy.observe(section);
}

/* ---------- Datenquellen ---------- */

async function loadItems() {
    // Zukunft: publizierte Community-Kreationen mit echtem Foto-Render.
    let live = [];
    try {
        const res = await fetch("/api/gallery");
        const data = await res.json();
        live = (Array.isArray(data.items) ? data.items : [])
            .filter((it) => it && typeof it.img === "string" && it.img.startsWith("/"))
            .map((it) => ({ img: it.img, name: it.name || "—", by: it.by || "", type: it.type || "", style: it.style || "" }));
    } catch (_e) { /* offline/nicht konfiguriert → nur Showcase */ }

    let base = [];
    try {
        const res = await fetch("/js/design-engine/content/community-showcase.json");
        base = (await res.json()).items || [];
    } catch (_e) { /* ohne Showcase bleibt die Sphäre leer, Seite läuft weiter */ }

    return live.concat(base).slice(0, 36);
}

/* ---------- 3D-Boot ---------- */

async function boot() {
    const [THREE, gsapMod, items] = await Promise.all([
        import("three"),
        import("gsap"),
        loadItems(),
    ]);
    const gsap = gsapMod.default || gsapMod.gsap;
    if (!items.length) return;

    const RADIUS = 14;
    const FOV = 66;
    const PITCH_LIMIT = 0.5;

    // Deterministisches Layout (stabil über Reloads).
    let seed = 20260612;
    const rng = () => {
        seed |= 0;
        seed = (seed + 0x6D2B79F5) | 0;
        let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
        return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
    const rand = (min, max) => min + rng() * (max - min);
    const wrapPi = (a) => ((a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setClearColor(0x000000, 0);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 80);
    camera.rotation.order = "YXZ";

    const sizeToSection = () => {
        const w = Math.max(1, section.clientWidth);
        const h = Math.max(1, section.clientHeight);
        renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 2));
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
    };
    sizeToSection();
    new ResizeObserver(sizeToSection).observe(section);

    // Staubpartikel als leise Tiefen-Referenz.
    {
        const count = 160;
        const pos = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            const r = rand(4, 11.5);
            const theta = rand(0, Math.PI * 2);
            const y = rand(-0.8, 0.8);
            const ring = Math.sqrt(1 - y * y);
            pos[i * 3] = Math.cos(theta) * ring * r;
            pos[i * 3 + 1] = y * r;
            pos[i * 3 + 2] = Math.sin(theta) * ring * r;
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        scene.add(new THREE.Points(geo, new THREE.PointsMaterial({
            size: 0.04, color: 0x6f93a8, transparent: true, opacity: 0.35, depthWrite: false,
        })));
    }

    // Slots: 3 Bänder × 12, gejittert — organisches Raster.
    const slots = [];
    const bands = [-0.48, 0, 0.48];
    const offsets = [0, Math.PI / 12, Math.PI / 24];
    for (let b = 0; b < bands.length; b++) {
        for (let i = 0; i < 12; i++) {
            slots.push({
                yaw: i * (Math.PI / 6) + offsets[b] + rand(-0.08, 0.08),
                pitch: bands[b] + rand(-0.08, 0.08),
                radius: RADIUS + rand(-1.2, 0.8),
                scale: rand(0.8, 1.25),
            });
        }
    }
    for (let i = slots.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [slots[i], slots[j]] = [slots[j], slots[i]];
    }

    /* ----- Karten ----- */

    const geometry = new THREE.PlaneGeometry(1, 1);
    const cards = [];
    const pendingBloom = [];
    const state = {
        dragging: false, pointerId: null, moved: 0, downAt: 0,
        open: false, running: false, lastInteract: performance.now(),
    };
    const rot = { yaw: 0.4, pitch: 0 };
    const target = { yaw: 0.4, pitch: 0 };
    const vel = { yaw: 0, pitch: 0 };
    let activeCard = null;

    const downscale = (img) => {
        const long = 560;
        const k = Math.min(1, long / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.max(2, Math.round(img.width * k));
        c.height = Math.max(2, Math.round(img.height * k));
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        return c;
    };

    const loader = new THREE.ImageLoader();
    items.forEach((item, i) => {
        loader.load(item.img, (img) => {
            const slot = slots[i % slots.length];
            const tex = new THREE.CanvasTexture(downscale(img));
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
            const aspect = Math.min(1.7, Math.max(0.62, img.width / img.height));
            const h = (3.0 / Math.sqrt(aspect)) * slot.scale;
            const w = h * aspect;
            const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
                map: tex, transparent: true, toneMapped: false,
            }));
            const cp = Math.cos(slot.pitch);
            mesh.position.set(
                -Math.sin(slot.yaw) * cp * slot.radius,
                Math.sin(slot.pitch) * slot.radius,
                -Math.cos(slot.yaw) * cp * slot.radius,
            );
            mesh.lookAt(0, 0, 0);
            mesh.userData = { item, w, h };
            mesh.scale.set(0.001, 0.001, 1);
            scene.add(mesh);
            cards.push(mesh);
            if (state.running) bloom(mesh);
            else pendingBloom.push(mesh);
        }, undefined, () => console.warn("[community-sphere] Bild fehlt:", item.img));
    });

    function bloom(mesh) {
        const { w, h } = mesh.userData;
        if (REDUCED) { mesh.scale.set(w, h, 1); return; }
        gsap.to(mesh.scale, {
            x: w, y: h, duration: 1.0, ease: "back.out(1.3)",
            delay: rand(0, 0.45), overwrite: "auto",
        });
    }

    /* ----- Steuerung (Drag + Trägheit + Tasten; KEIN Wheel-Hijack) ----- */

    const clampPitch = () => {
        target.pitch = Math.min(PITCH_LIMIT, Math.max(-PITCH_LIMIT, target.pitch));
    };
    const wake = () => { state.lastInteract = performance.now(); };

    canvas.addEventListener("pointerdown", (e) => {
        if (state.open || state.pointerId !== null || (e.pointerType === "mouse" && e.button !== 0)) return;
        state.pointerId = e.pointerId;
        state.dragging = true;
        state.moved = 0;
        state.downAt = performance.now();
        vel.yaw = vel.pitch = 0;
        last.x = e.clientX;
        last.y = e.clientY;
        wake();
        section.classList.add("is-dragging");
        canvas.setPointerCapture(e.pointerId);
    });

    const pointer = { x: 0, y: 0, inside: false };
    const last = { x: 0, y: 0 };
    globalThis.addEventListener("pointermove", (e) => {
        pointer.x = e.clientX;
        pointer.y = e.clientY;
        if (!state.dragging || e.pointerId !== state.pointerId) return;
        // Deltas selbst aus clientX/Y bilden: movementX ist auf iOS-Safari für
        // Touch-Pointer unzuverlässig (0/ganzzahlig) → Ruckeln. clientX ist
        // subpixel-genau und überall konsistent.
        const dx = e.clientX - last.x;
        const dy = e.clientY - last.y;
        last.x = e.clientX;
        last.y = e.clientY;
        state.moved += Math.abs(dx) + Math.abs(dy);
        const s = e.pointerType === "touch" ? 1.3 : 1;   // Daumen-Swipe trägt weiter
        target.yaw += dx * 0.0042 * s;
        target.pitch += dy * 0.0026 * s;
        clampPitch();
        vel.yaw = vel.yaw * 0.8 + dx * 0.0042 * s * 0.2;
        vel.pitch = vel.pitch * 0.8 + dy * 0.0026 * s * 0.2;
        wake();
    });

    const endDrag = (e, allowTap) => {
        if (e.pointerId !== state.pointerId) return;
        state.pointerId = null;
        state.dragging = false;
        section.classList.remove("is-dragging");
        wake();
        if (allowTap && state.moved < 8 && performance.now() - state.downAt < 500) {
            vel.yaw = vel.pitch = 0;
            const mesh = pick(e.clientX, e.clientY);
            if (mesh) openDetail(mesh);
        }
    };
    globalThis.addEventListener("pointerup", (e) => endDrag(e, true));
    // Browser übernimmt (vertikales Scrollen auf Touch) → Drag sauber beenden.
    globalThis.addEventListener("pointercancel", (e) => endDrag(e, false));

    canvas.addEventListener("pointerenter", () => { pointer.inside = true; });
    canvas.addEventListener("pointerleave", () => { pointer.inside = false; });

    canvas.addEventListener("keydown", (e) => {
        if (state.open) return;
        // Enter/Space opens the creation centred in the view — the keyboard
        // equivalent of tapping a card (WCAG 2.1.1). Arrow keys rotate a card
        // to the centre, Enter opens it.
        if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
            e.preventDefault();
            const mesh = centeredCard();
            if (mesh) openDetail(mesh);
            return;
        }
        const step = {
            ArrowLeft: [0.22, 0], ArrowRight: [-0.22, 0],
            ArrowUp: [0, 0.15], ArrowDown: [0, -0.15],
        }[e.key];
        if (!step) return;
        e.preventDefault();
        target.yaw += step[0];
        target.pitch += step[1];
        clampPitch();
        wake();
    });

    /* ----- Hover (Raycast) + Label ----- */

    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let hovered = null;
    const labelEl = document.getElementById("sphere-label");
    const labelName = document.getElementById("sphere-label-name");
    const labelMeta = document.getElementById("sphere-label-meta");
    // Polite live region: the visual label is aria-hidden, so this is the only
    // read-out a keyboard/SR user gets of the centred creation (what Enter opens).
    const liveEl = document.getElementById("sphere-focus-live");
    const labelPos = { x: 0, y: 0 };

    function pick(cx, cy) {
        const r = canvas.getBoundingClientRect();
        if (cx < r.left || cx > r.right || cy < r.top || cy > r.bottom) return null;
        ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
        raycaster.setFromCamera(ndc, camera);
        const hits = raycaster.intersectObjects(cards, false);
        return hits.length ? hits[0].object : null;
    }

    // The creation nearest the centre of the view — what a keyboard user opens
    // with Enter. A raycast straight through the centre needs a near-exact hit,
    // which cards floating on the sphere wall rarely land on; instead project
    // each card to screen space and take the closest one in front of the camera
    // (within the central area), so Enter always has a sensible target.
    function centeredCard() {
        let best = null, bestD = Infinity;
        for (const m of cards) {
            const v = m.position.clone().project(camera);
            if (v.z > 1) continue; // behind the camera
            const d = Math.hypot(v.x, v.y);
            if (d < bestD) { bestD = d; best = m; }
        }
        return best && bestD < 0.55 ? best : null;
    }

    function metaLine(item) {
        const parts = [];
        if (item.by) parts.push(`${t("sphere.by")} ${item.by}`);
        if (item.type) parts.push(t("type." + item.type));
        if (item.style) parts.push(item.style);
        return parts.join(" · ");
    }

    function setHovered(mesh) {
        if (hovered === mesh) return;
        if (hovered) {
            const u = hovered.userData;
            gsap.to(hovered.scale, { x: u.w, y: u.h, duration: 0.4, ease: "power3.out", overwrite: "auto" });
        }
        hovered = mesh;
        section.classList.toggle("has-hover", Boolean(mesh));
        if (mesh && (FINE_POINTER || document.activeElement === canvas) && labelEl) {
            const u = mesh.userData;
            gsap.to(mesh.scale, { x: u.w * 1.06, y: u.h * 1.06, duration: 0.45, ease: "power3.out", overwrite: "auto" });
            labelName.textContent = u.item.name;
            labelMeta.textContent = metaLine(u.item);
            labelEl.classList.add("is-on");
            // Announce only when keyboard focus drives the centring — pointer
            // hover doesn't need it and would be noisy for AT users.
            if (liveEl && document.activeElement === canvas) {
                const m = metaLine(u.item);
                liveEl.textContent = u.item.name + (m ? ", " + m : "");
            }
        } else if (labelEl) {
            labelEl.classList.remove("is-on");
            if (liveEl) liveEl.textContent = "";
        }
    }

    /* ----- Detail-Overlay (Tap auf eine Karte) ----- */

    const detailImg = document.getElementById("sphere-detail-img");
    const detailName = document.getElementById("sphere-detail-name");
    const detailMeta = document.getElementById("sphere-detail-meta");
    const camPush = { p: 0 };
    let pushDir = null;

    function openDetail(mesh) {
        if (state.open) return;
        state.open = true;
        activeCard = mesh;
        setHovered(null);
        const item = mesh.userData.item;
        detailImg.src = item.img;
        detailImg.alt = item.name;
        detailName.textContent = item.name;
        detailMeta.textContent = metaLine(item);

        // Blick zentriert die Karte, Kamera schiebt leicht nach (kein Vollflug —
        // das Overlay übernimmt die Bühne).
        const n = mesh.position.clone().normalize();
        const yawGoal = target.yaw + wrapPi(Math.atan2(-n.x, -n.z) - target.yaw);
        vel.yaw = vel.pitch = 0;
        pushDir = n;
        if (!REDUCED) {
            gsap.to(target, { yaw: yawGoal, pitch: Math.asin(n.y), duration: 0.6, ease: "power2.inOut", overwrite: "auto" });
            gsap.to(camPush, { p: 1, duration: 0.55, ease: "power2.inOut", overwrite: "auto" });
        }
        openOverlay(detailEl, canvas);
    }

    onOverlayClosed = () => {
        if (!state.open) return;
        state.open = false;
        activeCard = null;
        wake();
        if (!REDUCED) gsap.to(camPush, { p: 0, duration: 0.5, ease: "power2.out", overwrite: "auto" });
        else camPush.p = 0;
    };

    /* ----- Render-Loop (läuft nur, wenn Sektion sichtbar) ----- */

    const clock = new THREE.Clock();
    function tick() {
        const dt = Math.min(clock.getDelta(), 0.05);
        const now = performance.now();

        if (!state.dragging && !state.open && (Math.abs(vel.yaw) > 1e-5 || Math.abs(vel.pitch) > 1e-5)) {
            target.yaw += vel.yaw * dt * 60;
            target.pitch += vel.pitch * dt * 60;
            clampPitch();
            const decay = Math.exp(-dt * 2.5);   // länger ausrollen (flüssiger)
            vel.yaw *= decay;
            vel.pitch *= decay;
        }
        // Leise Eigenrotation — pausiert, solange eine Karte gehovert ist
        // (sonst gleitet sie unter dem Cursor weg).
        if (!REDUCED && !state.open && !state.dragging && !hovered && now - state.lastInteract > 4000) {
            target.yaw += dt * 0.016;
        }

        const k = 1 - Math.exp(-dt * 4.3);   // weicheres Nachziehen (Lenis-Gefühl)
        rot.yaw += (target.yaw - rot.yaw) * k;
        rot.pitch += (target.pitch - rot.pitch) * k;
        camera.rotation.set(rot.pitch, rot.yaw, 0);
        if (pushDir) camera.position.copy(pushDir).multiplyScalar(camPush.p * 2.4);

        if (!state.open && !state.dragging && pointer.inside && FINE_POINTER) {
            setHovered(pick(pointer.x, pointer.y));
        } else if (!state.open && !state.dragging && document.activeElement === canvas) {
            // Keyboard focus: surface the centred card (name + scale-up) so the
            // user knows what Enter will open as they arrow the globe around.
            setHovered(centeredCard());
        } else if ((state.dragging || state.open) && hovered) {
            setHovered(null);
        }

        for (const m of cards) {
            const dim = state.open ? (m === activeCard ? 1 : 0.22) : 1;
            const o = m.material.opacity;
            if (Math.abs(o - dim) > 0.002) m.material.opacity = o + (dim - o) * Math.min(1, dt * 7);
        }

        if (labelEl && hovered) {
            const r = section.getBoundingClientRect();
            let lx, ly;
            if (FINE_POINTER && pointer.inside) {
                lx = pointer.x - r.left + 20;
                ly = pointer.y - r.top + 22;
            } else {
                // keyboard focus: anchor the label near the centre of the globe
                const cr = canvas.getBoundingClientRect();
                lx = cr.left - r.left + cr.width / 2 + 20;
                ly = cr.top - r.top + cr.height / 2 + 22;
            }
            labelPos.x += (lx - labelPos.x) * 0.25;
            labelPos.y += (ly - labelPos.y) * 0.25;
            labelEl.style.transform = `translate3d(${labelPos.x}px, ${labelPos.y}px, 0)`;
        }

        renderer.render(scene, camera);
    }

    const setRunning = (run) => {
        if (run === state.running) return;
        state.running = run;
        renderer.setAnimationLoop(run ? tick : null);
        if (run && pendingBloom.length) {
            pendingBloom.splice(0).forEach(bloom);
        }
    };
    let sectionInView = false;
    const visible = new IntersectionObserver((entries) => {
        sectionInView = entries.some((en) => en.isIntersecting);
        setRunning(sectionInView && !document.hidden);
    }, { rootMargin: "120px 0px" });
    visible.observe(section);
    document.addEventListener("visibilitychange", () => {
        setRunning(sectionInView && !document.hidden);
    });

    // Mess-Haken für headless-Checks (keine UI-Funktion).
    globalThis.__communitySphere = { state, cards, rot, target, camera, items, vel };
}
