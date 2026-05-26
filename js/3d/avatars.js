/**
 * Urban Revolution — Procedural Mannequins
 *
 * Builds an abstract fashion mannequin from Three.js primitives, scaled
 * from the user's measurements. No external GLB dependency = no load
 * failure path = graceful by default. PR A renders a single 'regular'
 * preset; multiple presets land in PR B.
 *
 * Public API:
 *   buildMannequin(measurements) → THREE.Group
 *     measurements: { height, chest, waist, hips, shoulder, arm, inseam, neck }
 *     all in cm; missing fields fall back to size-M defaults.
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

const MANNEQUIN_TONE = 0xe6d2bf;

function buildMannequin(measurements) {
    const m = { ...DEFAULT_MEASUREMENTS, ...(measurements || {}) };

    const group = new THREE.Group();
    group.name = "mannequin";

    const skinMat = new THREE.MeshStandardMaterial({
        color: MANNEQUIN_TONE,
        roughness: 0.78,
        metalness: 0.04,
    });

    const totalH = m.height / 100;
    const headR = totalH * 0.067;
    const neckH = totalH * 0.045;
    const legH = m.inseam / 100;
    const torsoTopY = legH + (totalH - legH - neckH - headR * 2);
    const torsoBottomY = legH;
    const torsoH = torsoTopY - torsoBottomY;

    const chestR = m.chest / 2 / 100;
    const waistR = m.waist / 2 / 100;
    const hipsR = m.hips / 2 / 100;
    const shoulderHalfW = m.shoulder / 2 / 100;
    const neckR = m.neck / 2 / 100;

    group.add(buildTorso(skinMat, {
        torsoBottomY, torsoTopY, torsoH,
        chestR, waistR, hipsR, shoulderHalfW, neckR,
    }));
    group.add(buildNeck(skinMat, torsoTopY, neckR, neckH));
    group.add(buildHead(skinMat, torsoTopY + neckH, headR));
    group.add(...buildArms(skinMat, torsoTopY, shoulderHalfW, m.arm / 100, totalH));
    group.add(...buildLegs(skinMat, legH, hipsR, totalH));

    group.traverse((o) => {
        if (o.isMesh) {
            o.castShadow = true;
            o.receiveShadow = true;
        }
    });

    return group;
}

function buildTorso(mat, d) {
    const profile = [
        new THREE.Vector2(d.hipsR * 0.95, d.torsoBottomY),
        new THREE.Vector2(d.hipsR, d.torsoBottomY + d.torsoH * 0.08),
        new THREE.Vector2(d.waistR, d.torsoBottomY + d.torsoH * 0.42),
        new THREE.Vector2(d.chestR * 0.97, d.torsoBottomY + d.torsoH * 0.72),
        new THREE.Vector2(d.shoulderHalfW * 0.92, d.torsoTopY - d.torsoH * 0.05),
        new THREE.Vector2(d.neckR * 1.1, d.torsoTopY),
    ];
    const geom = new THREE.LatheGeometry(profile, 48);
    return new THREE.Mesh(geom, mat);
}

function buildNeck(mat, baseY, r, h) {
    const neck = new THREE.Mesh(
        new THREE.CylinderGeometry(r * 0.95, r * 1.05, h, 24),
        mat
    );
    neck.position.y = baseY + h / 2;
    return neck;
}

function buildHead(mat, baseY, r) {
    const head = new THREE.Mesh(
        new THREE.SphereGeometry(r, 32, 24),
        mat
    );
    head.position.y = baseY + r;
    head.scale.set(0.88, 1.18, 0.95);
    return head;
}

function buildArms(mat, shoulderY, shoulderHalfW, armLen, totalH) {
    const armR = totalH * 0.027;
    return [-1, 1].map((side) => {
        const arm = new THREE.Mesh(
            new THREE.CapsuleGeometry(armR, armLen * 0.92, 8, 16),
            mat
        );
        arm.position.set(
            side * (shoulderHalfW + armR * 0.4),
            shoulderY - armR * 0.5 - armLen * 0.46,
            0
        );
        return arm;
    });
}

function buildLegs(mat, legH, hipsR, totalH) {
    const thighR = totalH * 0.052;
    const ankleR = totalH * 0.026;
    return [-1, 1].map((side) => {
        const leg = new THREE.Mesh(
            new THREE.CylinderGeometry(ankleR, thighR, legH, 24),
            mat
        );
        leg.position.set(side * hipsR * 0.45, legH / 2, 0);
        return leg;
    });
}

export const Avatars = { buildMannequin };
