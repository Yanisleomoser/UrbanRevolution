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

// Warmer, slightly desaturated mid-tone. The previous near-white
// (0xd8d4cf) clipped into the bloom pass and read as bare plastic;
// this sits below the highlight threshold and looks like skin.
const DEFAULT_SKIN_TONE = 0xc9a98c;
const DEFAULT_HAIR_COLOR = 0x3a2010;
// Torso depth (front-to-back) is ~75% of lateral width — real torsi are
// elliptical, not circular. Same factor applies at chest/waist/hips.
const TORSO_DEPTH_SCALE = 0.72;
// Arms rest in a relaxed A-pose: angled this far outward from straight
// down (radians). Reads as a natural stance, keeps the silhouette
// compact, and stops the arms from dominating the frame the way a full
// horizontal T-pose did. garments.js mirrors this exact value so sleeves
// stay concentric with the arms.
const ARM_SPLAY = Math.PI / 6; // 30°

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
    buildHands(skinMat, torsoTopY, shoulderHalfW, m.arm / 100, totalH).forEach(hand => group.add(hand));
    buildLegs(skinMat, legH, hipsR, totalH).forEach(leg => group.add(leg));
    buildFeet(skinMat, hipsR, totalH).forEach(foot => group.add(foot));

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
    const cylLen = armLen * 0.88;
    // Capsule's local long axis is +Y. Rotating by (π + side·splay) about
    // Z aligns it with the down-and-outward A-pose direction
    // dir = (side·sin, −cos): R_z(α)·(0,1,0) = (−sinα, cosα) = dir.
    const halfTotal = cylLen / 2 + armR;
    const dx = Math.sin(ARM_SPLAY);
    const dy = -Math.cos(ARM_SPLAY);
    return [-1, 1].map((side) => {
        const arm = new THREE.Mesh(
            new THREE.CapsuleGeometry(armR, cylLen, 8, 16),
            mat
        );
        arm.rotation.z = Math.PI + side * ARM_SPLAY;
        // Shoulder joint anchor; capsule centre sits half its length down
        // the A-pose direction so the top end meets the shoulder.
        const shoulderX = side * shoulderHalfW;
        const shoulderJointY = shoulderY - armR * 0.4;
        arm.position.set(
            shoulderX + side * dx * halfTotal,
            shoulderJointY + dy * halfTotal,
            0
        );
        return arm;
    });
}

// Stylised hands at the wrist end of each arm. Mirrors buildArms' A-pose
// geometry so the hand lands exactly on the capsule's far tip; flattened
// into a mitten-ish ovoid rather than modelling fingers (matches the
// abstract mannequin look, same spirit as the feet).
function buildHands(mat, shoulderY, shoulderHalfW, armLen, totalH) {
    const armR = totalH * 0.028;
    const cylLen = armLen * 0.88;
    const reach = cylLen + 2 * armR; // shoulder joint → wrist tip distance
    const handR = armR * 1.15;
    const dx = Math.sin(ARM_SPLAY);
    const dy = -Math.cos(ARM_SPLAY);
    // Pull the hand slightly inside the wrist tip so it overlaps the arm.
    const reachToHand = reach - handR * 0.6;
    return [-1, 1].map((side) => {
        const hand = new THREE.Mesh(new THREE.SphereGeometry(handR, 20, 16), mat);
        hand.position.set(
            side * shoulderHalfW + side * dx * reachToHand,
            shoulderY - armR * 0.4 + dy * reachToHand,
            0
        );
        hand.scale.set(0.82, 1.15, 0.7);
        return hand;
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

// Simple stylised feet so the figure rests on the ground plane instead of
// ending in floating cylinder stumps. Deliberately abstract (a rounded
// wedge pointing forward, +Z) to match the mannequin's primitive look.
function buildFeet(mat, hipsR, totalH) {
    const footLen = totalH * 0.135;
    const footW = totalH * 0.05;
    const footH = totalH * 0.035;
    const ankleR = totalH * 0.028;
    return [-1, 1].map((side) => {
        const foot = new THREE.Mesh(
            new THREE.BoxGeometry(footW, footH, footLen, 1, 1, 1),
            mat
        );
        // Shift forward so the heel sits under the ankle and the toe
        // points along +Z (the direction the mannequin faces).
        foot.position.set(
            side * hipsR * 0.42,
            footH / 2,
            footLen * 0.5 - ankleR
        );
        return foot;
    });
}

export const Avatars = { buildMannequin };
