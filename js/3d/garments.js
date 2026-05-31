/**
 * Urban Revolution — Parametric Garments
 *
 * Builds garment geometry on top of the mannequin's body coordinates.
 * Six types are supported (matches CONFIG.GARMENT_TYPES). Each builder
 * returns a THREE.Group anchored to the same coordinate system as the
 * mannequin (feet at y=0, facing +Z) and slightly larger than the body
 * so it visually wraps the figure rather than intersecting it.
 *
 * Public API:
 *   buildGarment(type, options) → THREE.Group | null
 *     type: one of CONFIG.GARMENT_TYPES
 *     options: { color, material, measurements, fit }
 *       color: hex string
 *       material: one of CONFIG.MATERIALS keys
 *       measurements: same shape as Avatars.buildMannequin's measurements
 *       fit: 0..1, 0=slim, 1=oversized
 *
 *   setColor(group, hex)
 *   setMaterialProps(group, materialKey)
 *     In-place updates without rebuilding geometry. Cheap.
 */

import * as THREE from "three";

const DEFAULT_MEASUREMENTS = {
    height: 175, chest: 96, waist: 82, hips: 98,
    shoulder: 44, arm: 62, inseam: 82, neck: 38,
};

// PBR props per material — values approximate visible difference
// between e.g. matte cotton and shiny silk. Tuned by eye, not measured.
const MATERIAL_PROPS = {
    cotton:    { roughness: 0.85, metalness: 0.00 },
    linen:     { roughness: 0.90, metalness: 0.00 },
    denim:     { roughness: 0.78, metalness: 0.05 },
    wool:      { roughness: 0.92, metalness: 0.00 },
    fleece:    { roughness: 0.95, metalness: 0.00 },
    silk:      { roughness: 0.35, metalness: 0.15 },
    polyester: { roughness: 0.50, metalness: 0.10 },
};

const TORSO_DEPTH_SCALE = 0.72;
// Must match ARM_SPLAY in avatars.js so sleeves track the arms' relaxed pose.
const ARM_SPLAY = Math.PI / 13; // ~14° (kept in sync with avatars.js)

function hexToInt(hex) {
    if (typeof hex !== "string") return 0x1a1a1a;
    const clean = hex.replace("#", "");
    const n = parseInt(clean, 16);
    return Number.isFinite(n) ? n : 0x1a1a1a;
}

function circToRadius(cm) {
    return cm / 100 / (2 * Math.PI);
}

function makeMaterial(color, materialKey) {
    const props = MATERIAL_PROPS[materialKey] || MATERIAL_PROPS.cotton;
    return new THREE.MeshStandardMaterial({
        color: hexToInt(color),
        roughness: props.roughness,
        metalness: props.metalness,
        side: THREE.DoubleSide,
    });
}

// Compute body landmarks once per build. Mirrors avatars.js so the
// garment sits exactly on the mannequin's surface.
function computeBodyLandmarks(measurements) {
    const m = { ...DEFAULT_MEASUREMENTS, ...(measurements || {}) };
    const totalH = m.height / 100;
    const inseam = m.inseam / 100;
    const headR = totalH * 0.067;
    const neckH = totalH * 0.05;
    const headH = headR * 2 * 1.12;
    const legH = inseam;
    const torsoBottomY = legH * 0.95;
    const torsoTopY = totalH - headH - neckH;
    const torsoH = torsoTopY - torsoBottomY;

    return {
        m, totalH, headR, neckH, legH,
        torsoBottomY, torsoTopY, torsoH,
        chestR: circToRadius(m.chest),
        waistR: circToRadius(m.waist),
        hipsR: circToRadius(m.hips),
        neckR: circToRadius(m.neck),
        shoulderHalfW: m.shoulder / 2 / 100,
        armLen: m.arm / 100,
    };
}

// Fit multiplier: how much larger than the body the garment sits.
// fit=0 → +4 %, fit=1 → +35 %. Mirrored on shoulder width for sleeves.
function fitFactor(fit, slimAdd = 0.04, looseAdd = 0.35) {
    const f = Math.max(0, Math.min(1, fit ?? 0.5));
    return 1 + slimAdd + f * (looseAdd - slimAdd);
}

function buildGarment(type, options) {
    const opt = options || {};
    const builder = BUILDERS[type] || BUILDERS.tshirt;
    const mat = makeMaterial(opt.color, opt.material);
    const lm = computeBodyLandmarks(opt.measurements);
    const group = builder(mat, lm, opt.fit);
    group.name = `garment:${type}`;
    group.traverse((o) => {
        if (o.isMesh) {
            o.castShadow = true;
            o.receiveShadow = true;
        }
    });
    return group;
}

function setColor(group, hex) {
    if (!group) return;
    const color = hexToInt(hex);
    group.traverse((o) => {
        if (o.isMesh && o.material) o.material.color.setHex(color);
    });
}

function setMaterialProps(group, materialKey) {
    if (!group) return;
    const props = MATERIAL_PROPS[materialKey] || MATERIAL_PROPS.cotton;
    group.traverse((o) => {
        if (o.isMesh && o.material) {
            o.material.roughness = props.roughness;
            o.material.metalness = props.metalness;
        }
    });
}

/* ============================================================
   Helpers — sleeves wrap the mannequin's arms (A-pose, down + out)
   ============================================================ */

// anchorY / anchorX describe the shoulder joint; the sleeve runs from
// there down the A-pose direction. CylinderGeometry's wide end (baseR,
// at −Y) lands at the shoulder and the narrow end (tipR, at +Y) at the
// wrist once the +Y axis is aligned with the down-and-outward direction.
function buildSleeve(mat, side, anchorY, anchorX, length, baseR, tipR) {
    const sleeve = new THREE.Mesh(
        new THREE.CylinderGeometry(tipR, baseR, length, 18, 1, true),
        mat
    );
    sleeve.rotation.z = Math.PI + side * ARM_SPLAY;
    const dx = Math.sin(ARM_SPLAY);
    const dy = -Math.cos(ARM_SPLAY);
    sleeve.position.set(
        side * (anchorX + dx * length / 2),
        anchorY + dy * length / 2,
        0
    );
    return sleeve;
}

/* ============================================================
   T-SHIRT
   ============================================================ */

function buildTshirt(mat, lm, fit) {
    const group = new THREE.Group();
    const f = fitFactor(fit, 0.06, 0.34);
    const hipsR = lm.hipsR * f;
    const waistR = lm.waistR * f * 1.02;
    const chestR = lm.chestR * f;
    const shoulderHalfW = lm.shoulderHalfW * fitFactor(fit, 0.04, 0.18);
    const neckOpening = lm.neckR * 1.35;

    const hemY = lm.torsoBottomY + lm.torsoH * 0.05;
    const topY = lm.torsoTopY;
    const torsoTotalH = topY - hemY;

    const profile = [
        new THREE.Vector2(hipsR * 0.96, hemY - 0.005),
        new THREE.Vector2(hipsR, hemY + 0.01),
        new THREE.Vector2(waistR, hemY + torsoTotalH * 0.40),
        new THREE.Vector2(chestR * 1.02, hemY + torsoTotalH * 0.72),
        new THREE.Vector2(shoulderHalfW * 0.94, topY - 0.03),
        new THREE.Vector2(neckOpening, topY),
    ];
    const torso = new THREE.Mesh(new THREE.LatheGeometry(profile, 48), mat);
    torso.scale.z = TORSO_DEPTH_SCALE;
    group.add(torso);

    // Kurze Ärmel — enden am Oberarm
    const sleeveLen = lm.armLen * 0.22;
    const armR = lm.totalH * 0.028;
    const sleeveR = armR * 1.55 * fitFactor(fit, 0.0, 0.25);
    // Match torso lathe top radius (shoulderHalfW * 0.94 in profile) so
    // the sleeve cap sits flush with the torso edge instead of leaving
    // bare shoulder visible between them.
    const sleeveAnchorX = shoulderHalfW * 0.94;
    [-1, 1].forEach((side) => {
        group.add(buildSleeve(
            mat, side,
            topY - armR * 0.4,
            sleeveAnchorX,
            sleeveLen,
            sleeveR * 1.05,
            sleeveR * 0.95
        ));
    });

    return group;
}

/* ============================================================
   HOODIE
   ============================================================ */

function buildHoodie(mat, lm, fit) {
    const group = new THREE.Group();
    const f = fitFactor(fit, 0.10, 0.40);
    const hipsR = lm.hipsR * f;
    const waistR = lm.waistR * f * 1.04;
    const chestR = lm.chestR * f * 1.02;
    const shoulderHalfW = lm.shoulderHalfW * fitFactor(fit, 0.08, 0.22);
    const neckOpening = lm.neckR * 1.5;

    const hemY = lm.torsoBottomY - lm.torsoH * 0.05;
    const topY = lm.torsoTopY + 0.02;
    const torsoTotalH = topY - hemY;

    const profile = [
        new THREE.Vector2(hipsR * 0.98, hemY - 0.005),
        new THREE.Vector2(hipsR * 1.02, hemY + 0.015),
        new THREE.Vector2(waistR * 1.04, hemY + torsoTotalH * 0.42),
        new THREE.Vector2(chestR * 1.05, hemY + torsoTotalH * 0.70),
        new THREE.Vector2(shoulderHalfW * 0.98, topY - 0.03),
        new THREE.Vector2(neckOpening, topY),
    ];
    const torso = new THREE.Mesh(new THREE.LatheGeometry(profile, 48), mat);
    torso.scale.z = TORSO_DEPTH_SCALE;
    group.add(torso);

    // Lange Ärmel — bis zum Handgelenk
    const armR = lm.totalH * 0.028;
    const sleeveR = armR * 1.7 * fitFactor(fit, 0.0, 0.25);
    const sleeveAnchorX = shoulderHalfW * 0.98;
    [-1, 1].forEach((side) => {
        group.add(buildSleeve(
            mat, side,
            topY - armR * 0.4,
            sleeveAnchorX,
            lm.armLen * 0.92,
            sleeveR * 1.05,
            sleeveR * 0.78
        ));
    });

    // Kapuze hinter dem Kopf
    const hoodBaseY = topY + 0.02;
    const hoodR = lm.headR * 1.45;
    const hood = new THREE.Mesh(
        new THREE.SphereGeometry(hoodR, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.62),
        mat
    );
    hood.position.set(0, hoodBaseY + hoodR * 0.45, -hoodR * 0.15);
    hood.scale.set(1.0, 1.05, 0.9);
    group.add(hood);

    return group;
}

/* ============================================================
   SHIRT (button-down style — with stand collar)
   ============================================================ */

function buildShirt(mat, lm, fit) {
    const group = new THREE.Group();
    const f = fitFactor(fit, 0.05, 0.28);
    const hipsR = lm.hipsR * f;
    const waistR = lm.waistR * f * 0.98;
    const chestR = lm.chestR * f * 1.01;
    const shoulderHalfW = lm.shoulderHalfW * fitFactor(fit, 0.04, 0.16);
    const neckOpening = lm.neckR * 1.25;

    const hemY = lm.torsoBottomY + lm.torsoH * 0.05;
    const topY = lm.torsoTopY;
    const torsoTotalH = topY - hemY;

    const profile = [
        new THREE.Vector2(hipsR * 0.95, hemY - 0.005),
        new THREE.Vector2(hipsR, hemY + 0.01),
        new THREE.Vector2(waistR, hemY + torsoTotalH * 0.42),
        new THREE.Vector2(chestR, hemY + torsoTotalH * 0.74),
        new THREE.Vector2(shoulderHalfW * 0.92, topY - 0.03),
        new THREE.Vector2(neckOpening, topY),
    ];
    const torso = new THREE.Mesh(new THREE.LatheGeometry(profile, 48), mat);
    torso.scale.z = TORSO_DEPTH_SCALE;
    group.add(torso);

    // Stehkragen — kurzer, leicht nach außen geöffneter Ring am
    // Halsausschnitt. Offener Zylinder (oben/unten ohne Deckel), unten am
    // Ausschnittradius, oben weiter — liest sich als Hemdkragen.
    const collarH = lm.neckR * 0.62;
    const collar = new THREE.Mesh(
        new THREE.CylinderGeometry(neckOpening * 1.32, neckOpening, collarH, 32, 1, true),
        mat
    );
    collar.position.y = topY + collarH / 2 - 0.006;
    collar.scale.z = TORSO_DEPTH_SCALE;
    group.add(collar);

    const armR = lm.totalH * 0.028;
    const sleeveR = armR * 1.5 * fitFactor(fit, 0.0, 0.18);
    const sleeveAnchorX = shoulderHalfW * 0.92;
    [-1, 1].forEach((side) => {
        group.add(buildSleeve(
            mat, side,
            topY - armR * 0.4,
            sleeveAnchorX,
            lm.armLen * 0.94,
            sleeveR * 1.0,
            sleeveR * 0.7
        ));
    });

    return group;
}

/* ============================================================
   PANTS
   ============================================================ */

function buildPants(mat, lm, fit) {
    const group = new THREE.Group();
    const f = fitFactor(fit, 0.03, 0.22);
    const waistR = lm.waistR * f;
    const hipsR = lm.hipsR * f;

    // Bund: schmaler Ring direkt unter dem Torso
    const waistY = lm.torsoBottomY + 0.02;
    const waistband = new THREE.Mesh(
        new THREE.CylinderGeometry(waistR * 1.02, waistR, 0.04, 32, 1, true),
        mat
    );
    waistband.position.y = waistY;
    waistband.scale.z = TORSO_DEPTH_SCALE;
    group.add(waistband);

    // Hüft-Bereich: lathe von Bund nach unten zum Schritt
    const crotchY = lm.torsoBottomY * 0.55;
    const seat = new THREE.Mesh(
        new THREE.LatheGeometry([
            new THREE.Vector2(waistR, waistY),
            new THREE.Vector2(hipsR * 1.04, waistY - (waistY - crotchY) * 0.4),
            new THREE.Vector2(hipsR * 0.75, crotchY + 0.02),
            new THREE.Vector2(hipsR * 0.55, crotchY),
        ], 32),
        mat
    );
    seat.scale.z = TORSO_DEPTH_SCALE;
    group.add(seat);

    // Zwei Hosenbeine — Zylinder mit leichter Verjüngung
    const thighR = lm.totalH * 0.062 * fitFactor(fit, 0.0, 0.25);
    const ankleR = lm.totalH * 0.034 * fitFactor(fit, 0.0, 0.3);
    [-1, 1].forEach((side) => {
        const leg = new THREE.Mesh(
            new THREE.CylinderGeometry(thighR, ankleR, crotchY, 24, 1, true),
            mat
        );
        leg.position.set(side * hipsR * 0.42, crotchY / 2, 0);
        group.add(leg);
    });

    return group;
}

/* ============================================================
   JACKET (closed-front, structured)
   ============================================================ */

function buildJacket(mat, lm, fit) {
    const group = new THREE.Group();
    const f = fitFactor(fit, 0.12, 0.35);
    const hipsR = lm.hipsR * f;
    const waistR = lm.waistR * f * 1.02;
    const chestR = lm.chestR * f * 1.05;
    const shoulderHalfW = lm.shoulderHalfW * fitFactor(fit, 0.12, 0.22);
    const neckOpening = lm.neckR * 1.4;

    const hemY = lm.torsoBottomY - 0.01;
    const topY = lm.torsoTopY + 0.025;
    const torsoTotalH = topY - hemY;

    const profile = [
        new THREE.Vector2(hipsR, hemY - 0.005),
        new THREE.Vector2(hipsR * 1.05, hemY + 0.02),
        new THREE.Vector2(waistR * 1.05, hemY + torsoTotalH * 0.42),
        new THREE.Vector2(chestR * 1.06, hemY + torsoTotalH * 0.72),
        new THREE.Vector2(shoulderHalfW * 1.02, topY - 0.025),
        new THREE.Vector2(neckOpening, topY),
    ];
    const torso = new THREE.Mesh(new THREE.LatheGeometry(profile, 48), mat);
    torso.scale.z = TORSO_DEPTH_SCALE;
    group.add(torso);

    // Front-Zipper — schmale vertikale Leiste mittig vorne (+Z). Gleiche
    // Material-Instanz wie der Korpus, damit setColor die Leiste mitfärbt;
    // sie liest sich über Geometrie/Schattenkante, nicht über die Farbe.
    // z liegt an der vordersten Stelle (Brust); zur Taille hin steht die
    // Leiste minimal proud — bei der abstrakten Figur unkritisch.
    const frontZ = chestR * 1.06 * TORSO_DEPTH_SCALE;
    const zip = new THREE.Mesh(
        new THREE.BoxGeometry(0.022, torsoTotalH * 0.98, 0.012),
        mat
    );
    zip.position.set(0, hemY + torsoTotalH / 2, frontZ - 0.004);
    group.add(zip);

    const armR = lm.totalH * 0.028;
    const sleeveR = armR * 1.85 * fitFactor(fit, 0.0, 0.2);
    const sleeveAnchorX = shoulderHalfW * 1.02;
    [-1, 1].forEach((side) => {
        group.add(buildSleeve(
            mat, side,
            topY - armR * 0.5,
            sleeveAnchorX,
            lm.armLen * 0.95,
            sleeveR,
            sleeveR * 0.78
        ));
    });

    return group;
}

/* ============================================================
   DRESS (fitted top + flared skirt)
   ============================================================ */

function buildDress(mat, lm, fit) {
    const group = new THREE.Group();
    const f = fitFactor(fit, 0.03, 0.22);
    const waistR = lm.waistR * f;
    const hipsR = lm.hipsR * f;
    const chestR = lm.chestR * f;
    const shoulderHalfW = lm.shoulderHalfW * fitFactor(fit, 0.02, 0.14);
    const neckOpening = lm.neckR * 1.45;

    // Oberteil: Schulter → Brust → Taille
    const waistY = lm.torsoBottomY + lm.torsoH * 0.25;
    const topY = lm.torsoTopY;
    const topH = topY - waistY;

    const topProfile = [
        new THREE.Vector2(waistR * 1.0, waistY),
        new THREE.Vector2(chestR * 1.02, waistY + topH * 0.55),
        new THREE.Vector2(shoulderHalfW * 0.85, topY - 0.025),
        new THREE.Vector2(neckOpening, topY),
    ];
    const top = new THREE.Mesh(new THREE.LatheGeometry(topProfile, 48), mat);
    top.scale.z = TORSO_DEPTH_SCALE;
    group.add(top);

    // Rock: von Taille bogenförmig nach außen + unten zum Knie
    const kneeY = lm.legH * 0.55;
    const skirtFlare = fitFactor(fit, 1.4, 2.2);
    const hemR = hipsR * skirtFlare;
    const skirtProfile = [
        new THREE.Vector2(waistR, waistY),
        new THREE.Vector2(hipsR * 1.02, waistY - (waistY - kneeY) * 0.25),
        new THREE.Vector2(hipsR * 1.18, waistY - (waistY - kneeY) * 0.55),
        new THREE.Vector2(hemR * 0.92, kneeY + 0.015),
        new THREE.Vector2(hemR, kneeY),
    ];
    const skirt = new THREE.Mesh(new THREE.LatheGeometry(skirtProfile, 48), mat);
    skirt.scale.z = TORSO_DEPTH_SCALE;
    group.add(skirt);

    return group;
}

const BUILDERS = {
    tshirt: buildTshirt,
    hoodie: buildHoodie,
    shirt: buildShirt,
    pants: buildPants,
    jacket: buildJacket,
    dress: buildDress,
};

export const Garments = { buildGarment, setColor, setMaterialProps };
