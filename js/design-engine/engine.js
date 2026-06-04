/**
 * Urban Revolution — Design Engine · Core
 *
 * Data-driven, adaptive node selector. NOT a hard-coded if/else tree — the
 * branching is emergent: each turn it picks the eligible node with the highest
 * `priority × informationGain`, where gain ≈ how much the node resolves
 * still-uncertain attributes (or, for soft mood nodes, how undecided the
 * archetype mix is). Answered/irrelevant nodes drop out via their `when` gate.
 *
 * Depends on globals DesignDNA + DesignCondition (classic scripts) — or, under
 * node, on the same names placed on the global object by the test harness.
 *
 *   load(contentBundle)                      → { nodes, archetypes, attributes }
 *   eligible(nodes, dna, answered)           → nodes passing `when`, unanswered
 *   informationGain(dna, node)               → 0..1
 *   nextNode(nodes, dna, answered, minGain)  → node | null
 *   choiceEffects(node, choiceId)            → effects object
 *   answer(dna, node, effects, answered)     → mutates dna + answered set
 *   finalize(dna, archetypes, required)      → completed dna
 */
const DesignEngine = (() => {
  const MIN_GAIN = 0.08;

  // Gentle "general → specific" bias so Phase A (mood) tends to come before B
  // (form) before … E (details), without hard-coding an order — gain can still
  // override it. The branching stays emergent; this only breaks near-ties.
  const PHASE_BIAS = { A: 1.0, B: 0.72, C: 0.58, D: 0.48, E: 0.4, F: 0.34, G: 0.3 };
  const phaseBias = (node) => PHASE_BIAS[node.phase] == null ? 0.45 : PHASE_BIAS[node.phase];
  // Below this normalised archetype entropy the style is "decided", so we stop
  // offering the remaining pure-soft mood signals (they'd otherwise resurface
  // late, between specific detail questions — brief §7 Bug 2).
  const SOFT_RETRACT_ENTROPY = 0.55;

  function targetPaths(node) {
    if (node.bind) return [node.bind];
    if (node.modality === "colorGradient") return ["color.scheme"];
    const set = new Set();
    const collect = (eff) => eff && eff.set && Object.keys(eff.set).forEach((k) => set.add(k));
    (node.choices || []).forEach((c) => collect(c.effects));
    (node.pair || []).forEach((p) => collect(p.effects));
    (node.regions || []).forEach((r) => (r.choices || []).forEach((c) => collect(c.effects)));
    return [...set];
  }

  function hasWeights(node) {
    const has = (eff) => eff && eff.weight && Object.keys(eff.weight).length;
    if (node.weightAt) return true;
    return (node.choices || []).some((c) => has(c.effects)) ||
           (node.pair || []).some((p) => has(p.effects)) ||
           (node.options || []).some((o) => has(o.effects)) ||
           (node.regions || []).some((r) => (r.choices || []).some((c) => has(c.effects)));
  }

  function attrGain(dna, node) {
    const paths = targetPaths(node);
    if (!paths.length) return 0.3;
    let s = 0;
    paths.forEach((p) => (s += 1 - DesignDNA.confidence(dna, p)));
    return s / paths.length;
  }

  // Normalised Shannon entropy of the softmaxed archetype weights. All-zero
  // weights (nothing decided yet) → 1 (max uncertainty) → mood nodes win early.
  function archetypeEntropy(dna) {
    const ws = Object.values(dna.archetypeWeights || {});
    if (!ws.length) return 0;
    const exps = ws.map((w) => Math.exp(w));
    const sum = exps.reduce((a, b) => a + b, 0) || 1;
    const ps = exps.map((e) => e / sum);
    let h = 0;
    ps.forEach((p) => { if (p > 0) h -= p * Math.log(p); });
    return h / Math.log(ps.length);
  }

  function informationGain(dna, node) {
    const attr = attrGain(dna, node);
    const soft = hasWeights(node) ? 0.5 * archetypeEntropy(dna) : 0;
    return Math.max(attr, soft);
  }

  function eligible(nodes, dna, answered) {
    const done = answered || new Set();
    return (nodes || []).filter(
      (n) => !done.has(n.id) && DesignCondition.evaluate(n.when, dna)
    );
  }

  // A phase-A node that resolves no concrete attribute (pure archetype-weight
  // mood signal). Once the style is decided, these are retracted.
  function isPureSoftMood(node) {
    return node.phase === "A" && targetPaths(node).length === 0;
  }

  function nextNode(nodes, dna, answered, minGain) {
    const floor = minGain == null ? MIN_GAIN : minGain;
    const entropy = archetypeEntropy(dna);
    const elig = eligible(nodes, dna, answered).filter(
      (n) => !(isPureSoftMood(n) && entropy < SOFT_RETRACT_ENTROPY)
    );

    const pick = (pool) => {
      let best = null;
      let bestScore = floor;
      pool.forEach((n) => {
        const score = (n.priority == null ? 0.5 : n.priority) * informationGain(dna, n) * phaseBias(n);
        if (score > bestScore) { bestScore = score; best = n; }
      });
      return best;
    };

    // General → specific (brief §6): keep resolving Phase A (mood & intent)
    // before any later phase. Only once no Phase-A node still scores above the
    // floor do we open Phase B+.
    return pick(elig.filter((n) => n.phase === "A")) || pick(elig.filter((n) => n.phase !== "A"));
  }

  function choiceEffects(node, choiceId) {
    if (node.choices) {
      const c = node.choices.find((x) => x.id === choiceId);
      return c ? c.effects : null;
    }
    if (node.pair) {
      const p = node.pair.find((x) => x.id === choiceId);
      return p ? p.effects : null;
    }
    return null;
  }

  // Applies a resolved effects object (from any modality), stamps confidence,
  // and records the node as answered so it won't be offered again.
  function answer(dna, node, effects, answered, setConf) {
    DesignDNA.applyEffects(dna, effects, setConf);
    if (answered && node) answered.add(node.id);
    return dna;
  }

  function finalize(dna, archetypes, required, threshold) {
    return DesignDNA.completeFrom(dna, archetypes, required, threshold);
  }

  return {
    MIN_GAIN,
    targetPaths, informationGain, archetypeEntropy,
    eligible, nextNode, choiceEffects, answer, finalize,
  };
})();

if (typeof window !== "undefined") window.DesignEngine = DesignEngine;
if (typeof module !== "undefined" && module.exports) module.exports = DesignEngine;
