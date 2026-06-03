/**
 * Urban Revolution — Design Engine · Modality "slider"
 * A range between two labelled poles. Drags emit ctx.live(value) for a live
 * preview nudge; "confirm" commits the 0..1 value. Keyboard-operable (native
 * range input). Soft archetype nudges at the extremes resolve in the flow.
 */
(function () {
  const V = window.DEVisuals;

  function render(host, node, ctx) {
    host.innerHTML = "";
    const lang = ctx.lang;
    const axis = (node.axis && node.axis[lang]) || ["", ""];

    const q = V.el("h2", { class: "de-question" });
    q.textContent = node.question ? node.question[lang] : "";
    host.appendChild(q);

    const wrap = V.el("div", { class: "de-slider" });
    const poles = V.el("div", { class: "de-slider-poles" });
    const lo = V.el("span", {}); lo.textContent = axis[0];
    const hi = V.el("span", {}); hi.textContent = axis[1];
    poles.appendChild(lo); poles.appendChild(hi);

    const input = V.el("input", { type: "range", min: "0", max: "100", value: "50", class: "de-range" });
    input.setAttribute("aria-label", node.question ? node.question[lang] : "");
    input.addEventListener("input", () => ctx.live(input.value / 100));

    wrap.appendChild(poles);
    wrap.appendChild(input);
    host.appendChild(wrap);

    const confirm = V.el("button", { type: "button", class: "de-confirm" });
    confirm.textContent = ctx.t("engine.confirm");
    confirm.addEventListener("click", () => ctx.commit(input.value / 100));
    host.appendChild(confirm);
  }

  window.DEModalities = window.DEModalities || {};
  window.DEModalities.slider = render;
})();
