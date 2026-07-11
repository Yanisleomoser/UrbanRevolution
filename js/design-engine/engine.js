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
  // Gentle "general → specific" bias. Soft enough that the high-priority
  // category node (Phase B) surfaces right after the first couple of mood
  // signals — so the user sees their garment (and its live preview) early
  // instead of after a long intent intro.
  const PHASE_BIAS = { A: 1.0, B: 0.9, C: 0.8, D: 0.7, E: 0.6, F: 0.5, G: 0.45 };
  const phaseBias = (node) => PHASE_BIAS[node.phase] == null ? 0.6 : PHASE_BIAS[node.phase];
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
    // A single archetype (or none) leaves nothing to be uncertain about — also
    // guards Math.log(ps.length) below, which would be Math.log(1) === 0 and
    // produce NaN (and NaN silently poisons Math.max in informationGain, e.g.
    // via a crafted/legacy #dna= share link with a single-key archetypeWeights).
    if (ws.length <= 1) return 0;
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

  // A phase-A "mood signal": either it resolves no concrete attribute (pure
  // archetype-weight pair) OR it's an abstract mood_/inspo_ this-or-that. The id
  // check is load-bearing: some mood pairs (e.g. mood_clean_expressive) ALSO set
  // a concrete attr on one branch (pattern.type:"none"), so targetPaths() is
  // non-empty and they'd otherwise escape retraction and resurface between
  // concrete detail questions — the exact defect this guard exists to prevent.
  // Scoped to modality "thisOrThat": a mood_/inspo_-prefixed node of a DIFFERENT
  // modality (e.g. mood_rank, a real `ranking` question with its own bind and
  // confidence gate) is not one of these soft pairs and must not be retracted
  // by the same id-prefix match — that previously made mood_rank unreachable
  // in every journey (it always lost the priority race to category_select
  // before this guard could ever legitimately let it through).
  function isPureSoftMood(node) {
    return node.phase === "A" &&
      (targetPaths(node).length === 0 ||
        (node.modality === "thisOrThat" && /^(mood_|inspo_)/.test(node.id)));
  }

  function nextNode(nodes, dna, answered, minGain) {
    const floor = minGain == null ? MIN_GAIN : minGain;
    const entropy = archetypeEntropy(dna);
    let best = null;
    let bestScore = floor;
    eligible(nodes, dna, answered).forEach((n) => {
      // Retract pure-soft mood signals once the style is decided OR the garment
      // category is chosen (brief §7 Bug 2) — so an abstract "this or that" mood
      // pair never resurfaces between specific detail questions.
      if (isPureSoftMood(n) && (entropy < SOFT_RETRACT_ENTROPY || DesignDNA.get(dna, "category") != null)) return;
      const score = (n.priority == null ? 0.5 : n.priority) * informationGain(dna, n) * phaseBias(n);
      if (score > bestScore) { bestScore = score; best = n; }
    });
    return best;
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
