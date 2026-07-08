/**
 * Urban Revolution — Design Engine · Condition Evaluator
 *
 * A tiny, SAFE expression evaluator for Decision-Node `when` strings. No
 * `eval`, no `Function` — a hand-written tokeniser + recursive-descent parser
 * over a fixed grammar:
 *
 *   expr   := or
 *   or     := and ( '||' and )*
 *   and    := cmp ( '&&' cmp )*
 *   cmp    := primary ( ('=='|'!='|'<='|'>='|'<'|'>') primary )?
 *   primary:= '(' expr ')' | number | 'string' | true | false | path
 *   path   := ident ( '.' ident-or-index )*     // resolved against the DNA
 *
 * Paths resolve by nested walk (arrays via numeric index). A missing
 * `_confidence.*` path resolves to 0 (unanswered = no confidence), so
 * gates like `_confidence.silhouette.fit < 0.6` are true before the
 * attribute is decided. Any parse/eval error returns false (fail-closed:
 * a malformed node simply never shows).
 */
const DesignCondition = (() => {
  function tokenize(src) {
    const tokens = [];
    // Numbers accept an optional leading '-' (unary sign): the grammar has no
    // subtraction operator, so a '-' can only ever be a sign prefix here —
    // without it, any `when` string with a negative bound (e.g. "x > -0.2")
    // hit an unmatched character and failed closed (node silently never shown).
    const re =
      /\s*(?:(-?\d+(?:\.\d+)?)|'([^']*)'|(==|!=|<=|>=|&&|\|\||[<>()])|([A-Za-z_][A-Za-z0-9_.]*))/g;
    let m;
    let last = 0;
    while ((m = re.exec(src)) !== null) {
      if (m.index !== last) break; // gap = unexpected char
      last = re.lastIndex;
      if (m[1] !== undefined) tokens.push({ t: "num", v: parseFloat(m[1]) });
      else if (m[2] !== undefined) tokens.push({ t: "str", v: m[2] });
      else if (m[3] !== undefined) tokens.push({ t: "op", v: m[3] });
      else if (m[4] !== undefined) {
        if (m[4] === "true") tokens.push({ t: "bool", v: true });
        else if (m[4] === "false") tokens.push({ t: "bool", v: false });
        else tokens.push({ t: "path", v: m[4] });
      }
    }
    if (last !== src.length) throw new Error("unexpected token near " + src.slice(last));
    return tokens;
  }

  function resolve(dna, path) {
    const parts = path.split(".");
    let cur = dna;
    for (const p of parts) {
      if (cur == null) {
        return path.indexOf("_confidence") === 0 ? 0 : undefined;
      }
      cur = Array.isArray(cur) ? cur[parseInt(p, 10)] : cur[p];
    }
    if (cur === undefined && path.indexOf("_confidence") === 0) return 0;
    return cur;
  }

  function parse(tokens, dna) {
    let i = 0;
    const peek = () => tokens[i];
    const eat = () => tokens[i++];

    function primary() {
      const tk = peek();
      if (!tk) throw new Error("unexpected end");
      if (tk.t === "op" && tk.v === "(") {
        eat();
        const v = orExpr();
        const close = eat();
        if (!close || close.v !== ")") throw new Error("missing )");
        return v;
      }
      eat();
      if (tk.t === "num" || tk.t === "str" || tk.t === "bool") return tk.v;
      if (tk.t === "path") return resolve(dna, tk.v);
      throw new Error("unexpected token " + JSON.stringify(tk));
    }

    function cmpExpr() {
      const left = primary();
      const tk = peek();
      if (tk && tk.t === "op" && ["==", "!=", "<", ">", "<=", ">="].includes(tk.v)) {
        eat();
        const right = primary();
        switch (tk.v) {
          case "==": return left === right;
          case "!=": return left !== right;
          case "<": return Number(left) < Number(right);
          case ">": return Number(left) > Number(right);
          case "<=": return Number(left) <= Number(right);
          case ">=": return Number(left) >= Number(right);
        }
      }
      return left;
    }

    function andExpr() {
      let v = cmpExpr();
      while (peek() && peek().v === "&&") {
        eat();
        const r = cmpExpr();
        v = Boolean(v) && Boolean(r);
      }
      return v;
    }

    function orExpr() {
      let v = andExpr();
      while (peek() && peek().v === "||") {
        eat();
        const r = andExpr();
        v = Boolean(v) || Boolean(r);
      }
      return v;
    }

    const result = orExpr();
    if (i !== tokens.length) throw new Error("trailing tokens");
    return result;
  }

  function evaluate(expr, dna) {
    if (expr === true || expr === "true" || expr == null || expr === "") return true;
    try {
      return Boolean(parse(tokenize(String(expr)), dna || {}));
    } catch (err) {
      console.warn("[DesignCondition] bad expression:", expr, err.message);
      return false;
    }
  }

  return { evaluate, _resolve: resolve, _tokenize: tokenize };
})();

if (typeof window !== "undefined") window.DesignCondition = DesignCondition;
if (typeof module !== "undefined" && module.exports) module.exports = DesignCondition;
