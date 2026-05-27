/**
 * Urban Revolution — Procedural Mannequins
 *
 * Builds an abstract fashion mannequin from Three.js primitives, scaled
 * from the user's measurements. No external GLB dependency = no load
 * failure path = graceful by default.
 *
 * Public API:
 *   buildMannequin(measurements, appearance) → THREE.Group
 *     measurements: { height, chest, waist, hips, shoulder, arm, inseam, neck }
 *     all in cm; missing fields fall back to size-M defaults.
 *     appearance: { skinTone?: hex, hairColor?: hex | null }
 *     skinTone overrides the default mannequin material color.
 *     hairColor null = no hair geometry rendered (bald / no photo).
 *
 * The returned group is positioned with feet at y=0 and faces +Z (toward
 * the default camera at z=+4.2). Caller owns the group's lifecycle and
 * is expected to dispose it via Scene.remove() before building a new one.
 */

import * as THREE from "three";

const DEFAULT_MEASUREMENTS = {
    height: 175,
    chest: 96,
    waist: 82,
    hips: 98,
    shoulder: 44,
    arm: 62,
    inseam: 82,
    neck: 38,
};

const DEFAULT_SKIN_TONE = 0xd8d4cf;
const DEFAULT_HAIR_COLOR = 0x3a2010;
// Torso depth (front-to-back) is ~75% of lateral width — real torsi are
// elliptical, not circular. Same factor applies at chest/waist/hips.
const TORSO_DEPTH_SCALE = 0.72;

function hexToInt(hex) {
    if (typeof hex !== "string") return null;
    const clean = hex.replace("#", "");
    if (clean.length !== 6) return null;
    const n = parseInt(clean, 16);
    return Number.isFinite(n) ? n : null;
}

// Convert a body-part circumference (cm) to an equivalent radius (m).
// Lathe geometry rotates around Y so its cross-section is circular; we
// later flatten the Z axis via TORSO_DEPTH_SCALE to approximate the
// real elliptical torso.
function circToRadius(circumference_cm) {
    return circumference_cm / 100 / (2 * Math.PI);
}

function buildMannequin(measurements, appearance) {
    const m = { ...DEFAULT_MEASUREMENTS, ...(measurements || {}) };
    const a = appearance || {};

    const group = new THREE.Group();
    group.name = "mannequin";

    const skinColor = hexToInt(a.skinTone) ?? DEFAULT_SKIN_TONE;
    const skinMat = new THREE.MeshStandardMaterial({
        color: skinColor,
        roughness: 0.82,
        metalness: 0.02,
    });

    const totalH = m.height / 100;
    const inseam = m.inseam / 100;
    const headR = totalH * 0.067;
    const neckH = totalH * 0.05;
    const headH = headR * 2 * 1.12;

    const legH = inseam;
    const torsoBottomY = legH * 0.95;
    const torsoTopY = totalH - headH - neckH;
    const torsoH = torsoTopY - torsoBottomY;

    const chestR = circToRadius(m.chest);
    const waistR = circToRadius(m.waist);
    const hipsR = circToRadius(m.hips);
    const neckR = circToRadius(m.neck);
    const shoulderHalfW = m.shoulder / 2 / 100;

    group.add(buildTorso(skinMat, {
        torsoBottomY, torsoTopY, torsoH,
        chestR, waistR, hipsR, shoulderHalfW, neckR,
    }));
    group.add(buildNeck(skinMat, torsoTopY, neckR, neckH));
    group.add(buildHead(skinMat, torsoTopY + neckH, headR));
    buildArms(skinMat, torsoTopY, shoulderHalfW, m.arm / 100, totalH).forEach(arm => group.add(arm));
    buildLegs(skinMat, legH, hipsR, totalH).forEach(leg => group.add(leg));

    // Haar nur wenn explizit gewollt (User-Foto-Sampling oder Default-Wert).
    // appearance.hairColor === null bedeutet "keine Haare rendern" (Glatze /
    // kein Foto hochgeladen wenn appearance.skinTone auch null ist).
    if (a.hairColor !== null) {
        const hairColor = hexToInt(a.hairColor) ?? DEFAULT_HAIR_COLOR;
        group.add(buildHair(hairColor, torsoTopY + neckH, headR));
    }

    group.traverse((o) => {
        if (o.isMesh) {
            o.castShadow = true;
            o.receiveShadow = true;
        }
    });

    return group;
}

function buildTorso(mat, d) {
    // Smooth profile from hips up through waist/chest to shoulders.
    // The shoulder point is wider than chest to give silhouette some
    // structure; lathe rotates so this becomes a circular shoulder cap.
    const profile = [
        new THREE.Vector2(d.hipsR * 0.78, d.torsoBottomY - 0.02),
        new THREE.Vector2(d.hipsR, d.torsoBottomY + d.torsoH * 0.06),
        new THREE.Vector2(d.waistR * 1.02, d.torsoBottomY + d.torsoH * 0.40),
        new THREE.Vector2(d.chestR * 1.04, d.torsoBottomY + d.torsoH * 0.72),
        new THREE.Vector2(d.shoulderHalfW * 0.86, d.torsoTopY - d.torsoH * 0.04),
        new THREE.Vector2(d.shoulderHalfW * 0.62, d.torsoTopY),
        new THREE.Vector2(d.neckR * 1.15, d.torsoTopY + 0.005),
    ];
    const geom = new THREE.LatheGeometry(profile, 48);
    const torso = new THREE.Mesh(geom, mat);
    // Flatten depth so cross-section is elliptical, not circular
    torso.scale.z = TORSO_DEPTH_SCALE;
    return torso;
}

function buildNeck(mat, baseY, r, h) {
    const neck = new THREE.Mesh(
        new THREE.CylinderGeometry(r * 0.95, r * 1.1, h, 24),
        mat
    );
    neck.position.y = baseY + h / 2;
    neck.scale.z = TORSO_DEPTH_SCALE;
    return neck;
}

function buildHead(mat, baseY, r) {
    const head = new THREE.Mesh(
        new THREE.SphereGeometry(r, 32, 24),
        mat
    );
    head.position.y = baseY + r;
    head.scale.set(0.85, 1.15, 0.92);
    return head;
}

function buildArms(mat, shoulderY, shoulderHalfW, armLen, totalH) {
    const armR = totalH * 0.028;
    return [-1, 1].map((side) => {
        const arm = new THREE.Mesh(
            new THREE.CapsuleGeometry(armR, armLen * 0.88, 8, 16),
            mat
        );
        // Lay the capsule along the X axis (T-pose)
        arm.rotation.z = side * Math.PI / 2;
        // Anchor at shoulder, extend outward
        const armCenter = shoulderHalfW + (armLen * 0.88) / 2;
        arm.position.set(side * armCenter, shoulderY - armR * 0.4, 0);
        return arm;
    });
}

function buildHair(colorInt, headBaseY, headR) {
    const mat = new THREE.MeshStandardMaterial({
        color: colorInt,
        roughness: 0.85,
        metalness: 0.03,
    });
    // Eine leicht abgeflachte Halbkugel als Kappe oben auf dem Kopf —
    // bewusst stilisiert (keine Haarsträhnen), damit es zum abstrakten
    // Mannequin-Look passt.
    const hair = new THREE.Mesh(
        new THREE.SphereGeometry(headR * 1.05, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.62),
        mat
    );
    const headCenterY = headBaseY + headR;
    hair.position.y = headCenterY + headR * 0.05;
    hair.scale.set(0.92, 1.1, 0.98);
    return hair;
}

function buildLegs(mat, legH, hipsR, totalH) {
    const thighR = totalH * 0.055;
    const ankleR = totalH * 0.028;
    return [-1, 1].map((side) => {
        // CylinderGeometry(radiusTop, radiusBottom, …) — thigh at top, ankle at bottom
        const leg = new THREE.Mesh(
            new THREE.CylinderGeometry(thighR, ankleR, legH, 24),
            mat
        );
        leg.position.set(side * hipsR * 0.42, legH / 2, 0);
        leg.scale.z = 0.9;
        return leg;
    });
}

export const Avatars = { buildMannequin };
